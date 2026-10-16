import type { Check, CheckContext, Finding } from "./types";

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function daysInclusive(from: string, to: string): number {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86400000) + 1;
}

export function residentDays(ctx: CheckContext, state: string): number {
  return ctx.packet.household.residency.filter((r) => r.state === state && r.status === "resident").reduce((a, r) => a + daysInclusive(r.from, r.to), 0);
}

const residencyRatio: Check = {
  id: "residency-ratio",
  area: "state",
  title: "Resident-day ratio matches the household's dates",
  coverage: (ctx) => "The engine's California resident days (" + String((ctx.packet.engine_reference.parameters as Record<string, unknown>).ca_resident_days) + ") were recomputed from the residency dates the client entered.",
  run: (ctx) => {
    const out: Finding[] = [];
    const params = ctx.packet.engine_reference.parameters as Record<string, unknown>;
    const used = params.ca_resident_days;
    const computed = residentDays(ctx, "CA");
    if (isNum(used) && computed !== used) {
      out.push({
        id: "residency-ratio:days",
        check: "residency-ratio",
        area: "state",
        severity: "error",
        title: "Engine used " + used + " California resident days; the dates give " + computed,
        detail: ctx.packet.household.residency.map((r) => r.state + " " + r.from + " to " + r.to).join("; "),
        refs: ["ref:param.ca_resident_days", "household:" + ctx.packet.household.people[0].id],
        expected: String(computed),
        actual: String(used),
      });
    }
    return out;
  },
};

const PRORATED_RULES = new Set(["R-CA-INTEREST-SOURCE", "R-CA-DIVIDENDS-SOURCE", "R-CA-ADJ-SOURCE", "R-CA-BUSINESS-SOURCE"]);

const proration: Check = {
  id: "state-proration",
  area: "state",
  title: "Day-prorated California amounts recompute",
  coverage: (ctx) => [...ctx.lines.values()].filter((l) => PRORATED_RULES.has(l.rule)).length + " Schedule CA column E lines prorated by resident days were recomputed from column D.",
  run: (ctx) => {
    const out: Finding[] = [];
    const params = ctx.packet.engine_reference.parameters as Record<string, unknown>;
    const days = params.ca_resident_days;
    const yearDays = params.year_days;
    if (!isNum(days) || !isNum(yearDays)) return out;
    const ratio = days / yearDays;
    for (const l of ctx.lines.values()) {
      if (!PRORATED_RULES.has(l.rule) || !isNum(l.value)) continue;
      const base = l.inputs.map((k) => ctx.lineNum(k)).find(isNum);
      if (base === undefined) continue;
      const expected = Math.round(base * ratio);
      if (Math.abs(expected - l.value) > 2) {
        out.push({
          id: "state-proration:" + l.key,
          check: "state-proration",
          area: "state",
          severity: "error",
          title: l.key + " " + ctx.money(l.value) + " vs " + ctx.money(base) + " × " + days + "/" + yearDays,
          detail: l.label + " should be " + ctx.money(expected) + ".",
          refs: [l.key, ...l.inputs, "ref:param.ca_resident_days"],
          expected: ctx.money(expected),
          actual: ctx.money(l.value),
          difference: expected - l.value,
          effect: ctx.effect("ca_source_income", expected - l.value),
        });
      }
    }
    return out;
  },
};

/** A part-year resident's wages should be split; W-2 box 16 for the whole year is not that split. */
const partYearWages: Check = {
  id: "part-year-wages",
  area: "state",
  title: "California-source wages reflect the part-year move",
  coverage: () => "Schedule CA line 1 column E was compared with the residency dates, each W-2's state wages, and any paystub showing year-to-date California wages at the move.",
  run: (ctx) => {
    const out: Finding[] = [];
    const nonCa = ctx.packet.household.residency.filter((r) => r.state !== "CA");
    if (nonCa.length === 0) return out;
    const caWages = ctx.line("SchCA540NR.1.E");
    const totalWages = ctx.line("SchCA540NR.1.D");
    if (!caWages || !totalWages || !isNum(caWages.value) || !isNum(totalWages.value)) return out;
    if (caWages.value < totalWages.value - 1) return out;

    const paystubs = ctx.packet.documents.filter((d) => d.document_type === "paystub");
    const evidence: string[] = [];
    let overstatement = 0;
    const w2s = ctx.packet.documents.filter((d) => d.document_type === "W-2");
    for (const stub of paystubs) {
      const vals = ctx.index.valuesByDocument.get(stub.id) ?? [];
      const ytdCa = vals.find((v) => /ytd_ca/i.test(v.field) && isNum(v.value));
      if (!ytdCa) continue;
      const issuerKey = stub.issuer.split(/\s+/)[0].toLowerCase();
      const w2 = w2s.find((d) => d.issuer.toLowerCase().startsWith(issuerKey));
      const box16 = w2 ? (ctx.index.valuesByDocument.get(w2.id) ?? []).find((v) => v.field === "box16" && isNum(v.value)) : undefined;
      if (w2 && box16) {
        overstatement += (box16.value as number) - (ytdCa.value as number);
        evidence.push(
          stub.id + " shows year-to-date California wages of " + ctx.money(ytdCa.value as number) + " from " + stub.issuer + " at " + stub.title.replace(/^.*pay date /i, "") + ", while its W-2 (" + w2.id + ") reports " + ctx.money(box16.value as number) + " of California wages for the whole year",
        );
      }
      evidence.push(ytdCa.id);
    }
    const move = nonCa[0];
    out.push({
      id: "part-year-wages:SchCA540NR.1.E",
      check: "part-year-wages",
      area: "state",
      severity: "error",
      title: "All " + ctx.money(caWages.value) + " of wages treated as California-source despite the move to " + move.state + " on " + move.from,
      detail:
        "Column E equals column D, so wages earned after the move are being taxed by California. Employers report full-year wages in box 16 when the employee's address was never updated. " +
        (evidence.filter((e) => !e.startsWith("ev-")).join(". ") || "No paystub in the file shows the split") +
        "." +
        (overstatement > 0 ? " On that evidence alone California-source wages are overstated by at least " + ctx.money(overstatement) + "." : ""),
      refs: ["SchCA540NR.1.E", "SchCA540NR.1.D", ...paystubs.map((p) => p.id), ...w2s.map((w) => w.id), ...evidence.filter((e) => e.startsWith("ev-"))],
      actual: ctx.money(caWages.value),
      difference: overstatement > 0 ? -overstatement : undefined,
      effect: overstatement > 0 ? ctx.effect("ca_source_income", -overstatement) : null,
    });
    return out;
  },
};

export const stateChecks: Check[] = [residencyRatio, proration, partYearWages];
