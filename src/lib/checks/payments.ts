import type { Check, CheckContext, Finding } from "./types";

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/** Distinct W-2s: identical employer EIN and box 1 are images of one form. */
export function distinctW2s(ctx: CheckContext) {
  const seen = new Map<string, { docId: string; fields: Map<string, unknown> }>();
  for (const d of ctx.packet.documents) {
    if (d.document_type !== "W-2") continue;
    const fields = new Map((ctx.index.valuesByDocument.get(d.id) ?? []).map((v) => [v.field, v.value] as const));
    const key = String(fields.get("employer_ein")) + "|" + String(fields.get("box1"));
    if (!seen.has(key)) seen.set(key, { docId: d.id, fields });
  }
  return [...seen.values()];
}

function sumField(w2s: ReturnType<typeof distinctW2s>, field: string) {
  return w2s.reduce((a, w) => a + (isNum(w.fields.get(field)) ? (w.fields.get(field) as number) : 0), 0);
}

const federalEstimates: Check = {
  id: "federal-estimates",
  area: "payments",
  title: "Federal estimated payments agree to the IRS transcript",
  coverage: (ctx) => {
    const snap = ctx.packet.tax_agency_records.irs_account_transcript_2025.at(-1);
    return "Form 1040 line 26 was compared with estimated-payment transactions (code 670) on the IRS account transcript as of " + (snap?.as_of ?? "n/a") + ".";
  },
  run: (ctx) => {
    const out: Finding[] = [];
    const line = ctx.line("F1040.26");
    if (!line || !isNum(line.value)) return out;
    const snaps = ctx.packet.tax_agency_records.irs_account_transcript_2025;
    const snapIndex = snaps.length - 1;
    const snap = snaps[snapIndex];
    if (!snap) return out;
    const year = ctx.packet.household.tax_year;
    const est = snap.transactions
      .map((t, i) => ({ ...t, i }))
      .filter((t) => t.code === "670" && /estimated/i.test(t.description) && t.date >= year + "-01-01" && t.date <= year + 1 + "-01-31" && isNum(t.amount));
    const irsTotal = est.reduce((a, t) => a + (t.amount as number), 0);
    if (Math.abs(irsTotal - line.value) > 1) {
      const diff = irsTotal - line.value;
      out.push({
        id: "federal-estimates:F1040.26",
        check: "federal-estimates",
        area: "payments",
        severity: "error",
        title: "Federal estimated payments claimed " + ctx.money(line.value) + "; IRS shows " + ctx.money(irsTotal),
        detail:
          "The IRS account transcript lists " +
          est.map((t) => ctx.money(t.amount as number) + " on " + t.date).join(", ") +
          ". The return claims " +
          ctx.money(line.value) +
          (line.sources.some((s) => s.startsWith("qa-")) ? ", part of which rests on the client's questionnaire answer rather than a payment confirmation" : "") +
          ". Correcting it changes the balance due by " +
          ctx.money(-diff) +
          ".",
        refs: ["F1040.26", ...line.sources, ...est.map((t) => "agency:/irs_account_transcript_2025/" + snapIndex + "/transactions/" + t.i)],
        expected: ctx.money(irsTotal),
        actual: ctx.money(line.value),
        difference: diff,
        effect: { federal: -diff, california: 0 },
      });
    }
    return out;
  },
};

const federalWithholding: Check = {
  id: "federal-withholding",
  area: "wages",
  title: "Withholding agrees to the distinct Forms W-2",
  coverage: (ctx) => distinctW2s(ctx).length + " distinct W-2s (duplicate images counted once) were summed for box 2 and box 17.",
  run: (ctx) => {
    const out: Finding[] = [];
    const w2s = distinctW2s(ctx);
    const pairs: [string, string][] = [
      ["F1040.25a", "box2"],
      ["F540NR.71", "box17"],
    ];
    for (const [key, field] of pairs) {
      const line = ctx.line(key);
      if (!line || !isNum(line.value)) continue;
      const total = sumField(w2s, field);
      if (Math.abs(total - line.value) > 1) {
        out.push({
          id: "federal-withholding:" + key,
          check: "federal-withholding",
          area: "wages",
          severity: "error",
          title: key + " withholding " + ctx.money(line.value) + " vs W-2s " + ctx.money(total),
          detail: "The distinct Forms W-2 (" + w2s.map((w) => w.docId).join(", ") + ") show " + field + " totalling " + ctx.money(total) + ".",
          refs: [key, ...w2s.map((w) => w.docId)],
          expected: ctx.money(total),
          actual: ctx.money(line.value),
          difference: total - line.value,
        });
      }
    }
    return out;
  },
};

const w2Math: Check = {
  id: "w2-math",
  area: "wages",
  title: "Each W-2's boxes are internally consistent",
  coverage: (ctx) => distinctW2s(ctx).length + " W-2s were checked: box 4 = 6.2% of box 3, box 6 = 1.45% of box 5, and box 16 = box 1 plus HSA code W for California.",
  run: (ctx) => {
    const out: Finding[] = [];
    for (const w of distinctW2s(ctx)) {
      const f = (k: string) => (isNum(w.fields.get(k)) ? (w.fields.get(k) as number) : null);
      const b3 = f("box3");
      const b4 = f("box4");
      const b5 = f("box5");
      const b6 = f("box6");
      const checks: [string, number | null, number | null][] = [
        ["box 4 should be 6.2% of box 3", b4, b3 === null ? null : Math.round(b3 * 0.062)],
        ["box 6 should be 1.45% of box 5", b6, b5 === null ? null : Math.round(b5 * 0.0145)],
      ];
      for (const [label, actual, expected] of checks) {
        if (actual === null || expected === null) continue;
        if (Math.abs(actual - expected) > 1) {
          out.push({
            id: "w2-math:" + w.docId + ":" + label.split(" ")[1],
            check: "w2-math",
            area: "wages",
            severity: "warning",
            title: w.docId + ": " + label,
            detail: "Printed " + ctx.money(actual) + ", computed " + ctx.money(expected) + ".",
            refs: [w.docId],
            expected: ctx.money(expected),
            actual: ctx.money(actual),
          });
        }
      }
    }
    return out;
  },
};

const californiaEstimates: Check = {
  id: "california-estimates",
  area: "payments",
  title: "California estimated payments agree to the FTB account",
  coverage: (ctx) => "Form 540NR line 72 was compared with the FTB's record of payments applied to tax year " + ctx.packet.household.tax_year + ".",
  run: (ctx) => {
    const out: Finding[] = [];
    const line = ctx.line("F540NR.72");
    if (!line || !isNum(line.value)) return out;
    const ftb = ctx.packet.tax_agency_records.ftb_account as { tax_year_2025_payments?: { date: string; amount: number }[]; tax_year_2024_payments_after_filing?: { date: string; amount: number; note?: string }[] };
    const applied = ftb.tax_year_2025_payments ?? [];
    const total = applied.reduce((a, p) => a + (isNum(p.amount) ? p.amount : 0), 0);
    if (Math.abs(total - line.value) > 1) {
      const diff = total - line.value;
      const held = ftb.tax_year_2024_payments_after_filing ?? [];
      out.push({
        id: "california-estimates:F540NR.72",
        check: "california-estimates",
        area: "payments",
        severity: "error",
        title: "California estimates claimed " + ctx.money(line.value) + "; FTB applied " + ctx.money(total),
        detail:
          "The FTB account shows " +
          applied.map((p) => ctx.money(p.amount) + " on " + p.date).join(", ") +
          " for " +
          ctx.packet.household.tax_year +
          (held.length ? "; it holds " + held.map((p) => ctx.money(p.amount) + " paid " + p.date + (p.note ? " (" + p.note + ")" : "")).join(", ") + " as a prior-year credit" : "") +
          ". The engine counted every FTB payment in its date window regardless of the year the client designated. Correcting it changes the California balance by " +
          ctx.money(-diff) +
          ".",
        refs: ["F540NR.72", ...line.sources, "agency:/ftb_account/tax_year_2025_payments", "agency:/ftb_account/tax_year_2024_payments_after_filing"],
        expected: ctx.money(total),
        actual: ctx.money(line.value),
        difference: diff,
        effect: { federal: 0, california: -diff },
      });
    }
    return out;
  },
};

const extensionPayment: Check = {
  id: "extension-payment",
  area: "payments",
  title: "Extension payment agrees to the IRS transcript",
  coverage: () => "Schedule 3 line 10 was compared with the transcript's payment-with-extension transaction.",
  run: (ctx) => {
    const out: Finding[] = [];
    const line = ctx.line("Sch3.10");
    if (!line || !isNum(line.value)) return out;
    const snaps = ctx.packet.tax_agency_records.irs_account_transcript_2025;
    const i = snaps.length - 1;
    const tx = snaps[i]?.transactions.find((t) => t.code === "670" && /extension/i.test(t.description) && isNum(t.amount));
    if (!tx) {
      if (line.value !== 0) {
        out.push({
          id: "extension-payment:Sch3.10",
          check: "extension-payment",
          area: "payments",
          severity: "warning",
          title: "Extension payment " + ctx.money(line.value) + " not yet on the IRS transcript",
          detail: "No payment-with-extension transaction appears on the latest transcript snapshot.",
          refs: ["Sch3.10", ...line.sources],
        });
      }
      return out;
    }
    if (Math.abs((tx.amount as number) - line.value) > 1) {
      out.push({
        id: "extension-payment:Sch3.10",
        check: "extension-payment",
        area: "payments",
        severity: "error",
        title: "Extension payment " + ctx.money(line.value) + " vs IRS " + ctx.money(tx.amount as number),
        detail: "The transcript shows " + ctx.money(tx.amount as number) + " on " + tx.date + ".",
        refs: ["Sch3.10", ...line.sources],
        expected: ctx.money(tx.amount as number),
        actual: ctx.money(line.value),
      });
    }
    return out;
  },
};

export const paymentChecks: Check[] = [federalEstimates, federalWithholding, w2Math, californiaEstimates, extensionPayment];
