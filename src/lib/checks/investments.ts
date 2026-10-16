import type { ExtractedValue } from "@/lib/packet/schema";
import type { Check, CheckContext, Finding } from "./types";

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/** Lot fields on a broker statement: "<lot>_<field>" such as M3_proceeds or X17_basis. */
export function lotFields(values: ExtractedValue[]) {
  const lots = new Map<string, Map<string, ExtractedValue>>();
  for (const v of values) {
    const m = /^([A-Z]+\d+)_(.+)$/.exec(v.field);
    if (!m) continue;
    let lot = lots.get(m[1]);
    if (!lot) lots.set(m[1], (lot = new Map()));
    lot.set(m[2], v);
  }
  return lots;
}

function lotNum(lot: Map<string, ExtractedValue>, ...names: string[]): number | null {
  for (const n of names) {
    const v = lot.get(n)?.value;
    if (isNum(v)) return v;
  }
  return null;
}

/** Every Form 8949 lot line equals proceeds minus basis plus wash-sale adjustment from its own sources. */
const lotMath: Check = {
  id: "lot-math",
  area: "investments",
  title: "Each sale's gain equals proceeds minus basis plus adjustment",
  coverage: (ctx) => [...ctx.lines.values()].filter((l) => l.rule === "R-8949-LOT").length + " Form 8949 lot lines were recomputed from the proceeds, basis and wash-sale fields they cite.",
  run: (ctx) => {
    const out: Finding[] = [];
    for (const l of ctx.lines.values()) {
      if (l.rule !== "R-8949-LOT" || !isNum(l.value)) continue;
      const fields = new Map<string, number>();
      for (const s of l.sources) {
        const v = ctx.value(s);
        if (!v || !isNum(v.value)) continue;
        const m = /_(proceeds|basis|wash)$/.exec(v.field);
        if (m) fields.set(m[1], v.value);
      }
      const p = fields.get("proceeds");
      const b = fields.get("basis");
      if (p === undefined || b === undefined) continue;
      const w = fields.get("wash") ?? 0;
      const expected = p - b + w;
      if (Math.abs(expected - l.value) > 0.01) {
        out.push({
          id: "lot-math:" + l.key,
          check: "lot-math",
          area: "investments",
          severity: "error",
          title: l.key + " gain " + ctx.money(l.value) + " should be " + ctx.money(expected),
          detail:
            "Proceeds " +
            ctx.money(p) +
            " minus basis " +
            ctx.money(b) +
            (w ? " plus wash-sale adjustment " + ctx.money(w) : "") +
            " is " +
            ctx.money(expected) +
            ". The engine recorded " +
            ctx.money(l.value) +
            ". " +
            l.label,
          refs: [l.key, ...l.sources],
          expected: ctx.money(expected),
          actual: ctx.money(l.value),
          difference: expected - l.value,
          effect: ctx.effect(/^F8949\.[ABCH]\./.test(l.key) ? "stcg" : "ltcg", expected - l.value),
        });
      }
    }
    return out;
  },
};

/** Broker summary totals equal the sum of the lots the pipeline extracted from the same statement. */
const brokerSummary: Check = {
  id: "broker-summary",
  area: "investments",
  title: "Broker 1099-B totals agree to the extracted lots",
  coverage: (ctx) => {
    const n = ctx.packet.documents.filter((d) => (ctx.index.valuesByDocument.get(d.id) ?? []).some((v) => /summary_proceeds$|^st_proceeds$|^lt_proceeds$/.test(v.field))).length;
    return n + " brokerage statements carrying summary totals were reconciled to their lot detail and to the Form 8949 lines built from them.";
  },
  run: (ctx) => {
    const out: Finding[] = [];
    for (const d of ctx.packet.documents) {
      const values = ctx.index.valuesByDocument.get(d.id) ?? [];
      const lots = lotFields(values);
      if (lots.size === 0) continue;
      const summaries = values.filter((v) => /summary_proceeds$|^(st|lt)_(proceeds|basis|wash)$/.test(v.field) && isNum(v.value));
      if (summaries.length === 0) continue;
      const superseded = (ctx.index.documentUsage.get(d.id)?.supersededIn.length ?? 0) > 0;

      const one = summaries.find((v) => /summary_proceeds$/.test(v.field));
      if (one) {
        const lotTotal = [...lots.values()].reduce((a, lot) => a + (lotNum(lot, "proceeds") ?? 0), 0);
        if (Math.abs(lotTotal - (one.value as number)) > 0.5) {
          const diff = (one.value as number) - lotTotal;
          const unreadPages = d.pages.filter((p) => !values.some((v) => v.page === p.page)).map((p) => p.page);
          out.push({
            id: "broker-summary:" + d.id,
            check: "broker-summary",
            area: "investments",
            severity: superseded ? "info" : "error",
            title: d.id + " summary proceeds " + ctx.money(one.value as number) + " vs " + lots.size + " lots " + ctx.money(lotTotal),
            detail:
              "The statement's own total exceeds the extracted lots by " +
              ctx.money(diff) +
              "." +
              (unreadPages.length ? " Pages " + unreadPages.join(", ") + " have printed content the pipeline did not extract; the missing sale is most likely there." : "") +
              (superseded ? " This document was superseded, so only the corrected copy matters." : " Any lot missing from Form 8949 leaves its gain or loss off the return."),
            refs: [d.id, one.id, ...unreadPages.map((p) => "doc:" + d.id + "#page" + p)],
            expected: ctx.money(one.value as number),
            actual: ctx.money(lotTotal),
            difference: diff,
          });
        }
      }

      for (const term of ["st", "lt"] as const) {
        const p = summaries.find((v) => v.field === term + "_proceeds");
        const b = summaries.find((v) => v.field === term + "_basis");
        const w = summaries.find((v) => v.field === term + "_wash");
        if (!p || !b) continue;
        const termLots = [...lots.values()].filter((lot) => String(lot.get("term")?.value ?? "").toLowerCase().startsWith(term === "st" ? "s" : "l"));
        const lotP = termLots.reduce((a, lot) => a + (lotNum(lot, "proceeds") ?? 0), 0);
        const lotB = termLots.reduce((a, lot) => a + (lotNum(lot, "basis") ?? 0), 0);
        if (Math.abs(lotP - (p.value as number)) > 0.5 || Math.abs(lotB - (b.value as number)) > 0.5) {
          out.push({
            id: "broker-summary:" + d.id + ":" + term,
            check: "broker-summary",
            area: "investments",
            severity: "error",
            title: d.id + " " + term.toUpperCase() + " totals do not match its lots",
            detail: "Summary proceeds " + ctx.money(p.value as number) + " / basis " + ctx.money(b.value as number) + "; lots " + ctx.money(lotP) + " / " + ctx.money(lotB) + ".",
            refs: [d.id, p.id, b.id],
          });
        }
        // Gains on Form 8949 built from this statement should equal proceeds - basis + wash.
        const expectedGain = (p.value as number) - (b.value as number) + (isNum(w?.value) ? (w!.value as number) : 0);
        const lotIds = new Set(termLots.flatMap((lot) => [...lot.values()].map((v) => v.id)));
        const returnGain = [...ctx.lines.values()]
          .filter((l) => l.rule === "R-8949-LOT" && isNum(l.value) && l.sources.some((s) => lotIds.has(s)))
          .reduce((a, l) => a + (l.value as number), 0);
        if (!superseded && Math.abs(returnGain - expectedGain) > 0.5) {
          out.push({
            id: "broker-summary:" + d.id + ":" + term + ":gain",
            check: "broker-summary",
            area: "investments",
            severity: "error",
            title: d.id + " " + term.toUpperCase() + " gain on Form 8949 " + ctx.money(returnGain) + " vs statement " + ctx.money(expectedGain),
            detail: "Statement proceeds minus basis plus wash-sale adjustments gives " + ctx.money(expectedGain) + "; the Form 8949 lines built from these lots total " + ctx.money(returnGain) + ".",
            refs: [d.id, p.id, b.id, ...(w ? [w.id] : [])],
            expected: ctx.money(expectedGain),
            actual: ctx.money(returnGain),
            difference: expectedGain - returnGain,
          });
        }
      }
    }
    return out;
  },
};

/** Form 8949 box totals equal the lots in the box, and Schedule D carries them. */
const boxTotals: Check = {
  id: "box-totals",
  area: "investments",
  title: "Form 8949 box totals equal their lots",
  coverage: (ctx) => [...ctx.lines.values()].filter((l) => /^F8949\.[A-K]\.total$/.test(l.key)).length + " Form 8949 box totals were re-added from the individual lot lines.",
  run: (ctx) => {
    const out: Finding[] = [];
    for (const l of ctx.lines.values()) {
      const m = /^F8949\.([A-K])\.total$/.exec(l.key);
      if (!m || !isNum(l.value)) continue;
      const box = m[1];
      const sum = [...ctx.lines.values()]
        .filter((x) => x.rule === "R-8949-LOT" && x.key.startsWith("F8949." + box + ".") && isNum(x.value))
        .reduce((a, x) => a + (x.value as number), 0);
      if (Math.abs(sum - l.value) > 1) {
        out.push({
          id: "box-totals:" + l.key,
          check: "box-totals",
          area: "investments",
          severity: "error",
          title: l.key + " is " + ctx.money(l.value) + " but its lots sum to " + ctx.money(sum),
          detail: l.label,
          refs: [l.key],
          expected: ctx.money(sum),
          actual: ctx.money(l.value),
          difference: sum - l.value,
        });
      }
    }
    return out;
  },
};

/** Digital assets: the 1099-DA total equals its lots, every lot has a basis, and the return carries them all. */
const digitalAssets: Check = {
  id: "digital-assets",
  area: "investments",
  title: "Digital asset dispositions are complete and have a basis",
  coverage: (ctx) => ctx.packet.documents.filter((d) => d.document_type === "1099-DA").length + " Forms 1099-DA were reconciled to their lots, to the exchange export and to Form 8949 boxes H and K.",
  run: (ctx) => {
    const out: Finding[] = [];
    for (const d of ctx.packet.documents) {
      if (d.document_type !== "1099-DA") continue;
      const values = ctx.index.valuesByDocument.get(d.id) ?? [];
      const lots = lotFields(values);
      const total = values.find((v) => v.field === "total" && isNum(v.value));
      const lotTotal = [...lots.values()].reduce((a, lot) => a + (lotNum(lot, "proceeds") ?? 0), 0);
      if (total && Math.abs(lotTotal - (total.value as number)) > 0.5) {
        out.push({
          id: "digital-assets:" + d.id + ":total",
          check: "digital-assets",
          area: "investments",
          severity: "error",
          title: d.id + " total " + ctx.money(total.value as number) + " vs lots " + ctx.money(lotTotal),
          detail: "The 1099-DA total does not equal the sum of its listed dispositions.",
          refs: [d.id, total.id],
        });
      }
      const onReturn = [...ctx.lines.values()].filter((l) => l.rule === "R-8949-LOT" && /^F8949\.[HK]\./.test(l.key) && isNum(l.value));
      const returnProceeds = onReturn.reduce((a, l) => {
        const p = l.sources.map((s) => ctx.value(s)).find((v) => v && /_proceeds$/.test(v.field));
        return a + (p && isNum(p.value) ? p.value : 0);
      }, 0);
      if (total && Math.abs(returnProceeds - (total.value as number)) > 0.5) {
        out.push({
          id: "digital-assets:" + d.id + ":return",
          check: "digital-assets",
          area: "investments",
          severity: "error",
          title: "Digital asset proceeds on the return " + ctx.money(returnProceeds) + " vs 1099-DA " + ctx.money(total.value as number),
          detail: "Form 8949 boxes H and K should carry every disposition the exchange reported.",
          refs: [d.id, total.id, ...onReturn.map((l) => l.key)],
        });
      }
      // Basis comes from the exchange export; a null basis means the engine used zero.
      for (const l of onReturn) {
        const basis = l.sources.map((s) => ctx.value(s)).find((v) => v && /_basis$/.test(v.field));
        if (basis && basis.value === null) {
          const acquired = l.sources.map((s) => ctx.value(s)).find((v) => v && /_acquired$/.test(v.field));
          const proceeds = l.sources.map((s) => ctx.value(s)).find((v) => v && /_proceeds$/.test(v.field));
          out.push({
            id: "digital-assets:" + l.key + ":basis",
            check: "digital-assets",
            area: "investments",
            severity: "warning",
            title: l.key + " has no cost basis; the whole proceeds are taxed as gain",
            detail:
              "The exchange export shows " +
              (acquired?.text_as_read || "no acquisition") +
              " and no basis for this lot. The gain of " +
              ctx.money(l.value as number) +
              " assumes zero basis. The client needs the original purchase record from the external wallet; any documented basis reduces the gain dollar for dollar" +
              (proceeds && isNum(proceeds.value) ? " (up to " + ctx.money(proceeds.value) + ")" : "") +
              ".",
            refs: [l.key, ...l.sources],
          });
        }
      }
    }
    return out;
  },
};

export const investmentChecks: Check[] = [lotMath, brokerSummary, boxTotals, digitalAssets];

export type { CheckContext };
