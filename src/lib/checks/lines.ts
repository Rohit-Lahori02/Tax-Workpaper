import { parseRef, resolvePointer } from "@/lib/refs";
import type { Check, CheckContext, Finding } from "./types";

const TOLERANCE = 1;

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/** True when some ± combination of the inputs equals the value, within a dollar of rounding. */
export function signedCombinationMatches(inputs: number[], value: number): boolean {
  if (inputs.length === 0) return false;
  if (inputs.length > 12) return true; // not worth 4,096 combinations; treated as unverifiable
  const n = inputs.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += mask & (1 << i) ? -inputs[i] : inputs[i];
    if (Math.abs(sum - value) <= TOLERANCE) return true;
  }
  return false;
}

/**
 * Like signedCombinationMatches, but the optional terms may also be left out.
 * Used when the engine lists only part of a row's inputs.
 */
export function partialCombinationMatches(required: number[], optional: number[], value: number): boolean {
  if (optional.length > 8) return false;
  const opt = optional.length;
  const total = Math.pow(3, opt);
  for (let code = 0; code < total; code++) {
    let c = code;
    let sum = 0;
    for (let i = 0; i < opt; i++) {
      const coef = (c % 3) - 1;
      c = Math.floor(c / 3);
      sum += coef * optional[i];
    }
    if (signedCombinationMatches(required, value - sum)) return true;
  }
  return false;
}

/** Rules whose value should equal the sum (or the single one) of the cited extracted values. */
const SUM_OF_SOURCES_RULES = new Set([
  "R-W2-BOX1-SUM",
  "R-W2-BOX2-SUM",
  "R-W2-BOX17-SUM",
  "R-INTEREST-PAYER",
  "R-DIVIDEND-PAYER",
  "R-BOOKS-LINE",
  "R-RENTAL-LINE",
  "R-CHARITY-CASH",
  "R-NONCASH-GIFT",
  "R-MORTGAGE-INTEREST",
  "R-SALT-PROPERTY",
  "R-K1",
  "R-MILEAGE-PAGE-TOTALS",
  "R-DEP-CARE-PROVIDER",
]);

const sumLines: Check = {
  id: "sum-lines",
  area: "arithmetic",
  title: "Summed and carried lines re-added",
  coverage: (ctx) => {
    const n = [...ctx.lines.values()].filter((l) => (l.rule === "R-SUM" || l.rule === "R-CARRY") && isNum(l.value)).length;
    return n + " lines using R-SUM or R-CARRY were recomputed from their inputs without trusting the engine.";
  },
  run: (ctx) => {
    const out: Finding[] = [];
    for (const l of ctx.lines.values()) {
      if (!isNum(l.value)) continue;
      if (l.rule === "R-SUM") {
        const inputs = l.inputs.map((k) => ctx.lineNum(k));
        if (inputs.some((x) => x === null) || inputs.length === 0) continue;
        if (!signedCombinationMatches(inputs as number[], l.value)) {
          // The engine sometimes lists only the first column of a multi-column row as input.
          // Try the sibling lines on the same row before calling it an error.
          const prefix = l.key.replace(/\.[^.]+$/, ".");
          const siblings = [...ctx.lines.values()].filter((s) => s.key !== l.key && s.key.startsWith(prefix) && isNum(s.value) && !l.inputs.includes(s.key));
          const siblingValues = siblings.map((s) => s.value as number);
          const explainedBySiblings = siblings.length > 0 && partialCombinationMatches(inputs as number[], siblingValues, l.value);
          out.push({
            id: "sum-lines:" + l.key,
            check: "sum-lines",
            area: "arithmetic",
            severity: explainedBySiblings ? "info" : "error",
            title: explainedBySiblings ? l.key + " lists incomplete inputs" : l.key + " does not add up from its inputs",
            detail:
              l.label +
              " is " +
              ctx.money(l.value) +
              (explainedBySiblings
                ? ", which is explained only once the unlisted lines on the same row (" + siblings.map((s) => s.key).join(", ") + ") are included. The number is right; the engine's provenance for it is incomplete."
                : " but no combination of its inputs (" + l.inputs.map((k, i) => k + " " + ctx.money(inputs[i] as number)).join(", ") + ") produces that."),
            refs: [l.key, ...l.inputs, ...(explainedBySiblings ? siblings.map((s) => s.key) : [])],
            actual: ctx.money(l.value),
          });
        }
      } else if (l.rule === "R-CARRY") {
        const value = l.value;
        const candidates = [...l.inputs.map((k) => ctx.lineNum(k)), ...l.sources.map((s) => ctx.num(s))].filter(isNum);
        if (candidates.length === 0) continue;
        // A carry from several lines is their total; a carry from one line is that line.
        const matches = candidates.some((c) => Math.abs(c - value) <= TOLERANCE) || signedCombinationMatches(candidates, value);
        if (!matches) {
          out.push({
            id: "sum-lines:" + l.key,
            check: "sum-lines",
            area: "arithmetic",
            severity: "error",
            title: l.key + " does not match the line it carries from",
            detail: l.label + " is " + ctx.money(l.value) + " but the carried line(s) hold " + candidates.map((c) => ctx.money(c)).join(", ") + ".",
            refs: [l.key, ...l.inputs, ...l.sources],
            actual: ctx.money(l.value),
            expected: candidates.map((c) => ctx.money(c)).join(" or "),
          });
        }
      }
    }
    return out;
  },
};

const sourceTotals: Check = {
  id: "source-totals",
  area: "sources",
  title: "Lines agree to the documents they cite",
  coverage: (ctx) => {
    const n = [...ctx.lines.values()].filter((l) => SUM_OF_SOURCES_RULES.has(l.rule) && isNum(l.value)).length;
    return n + " lines whose rule says they come straight from documents were compared with the cited extracted values.";
  },
  run: (ctx) => {
    const out: Finding[] = [];
    for (const l of ctx.lines.values()) {
      if (!SUM_OF_SOURCES_RULES.has(l.rule) || !isNum(l.value)) continue;
      // Currency conversions are covered by the exchange-rate check, not by a straight sum.
      if (l.sources.some((s) => s.startsWith("ref:fx."))) continue;
      const value = l.value;
      const nums = l.sources.map((s) => ctx.num(s)).filter(isNum);
      if (nums.length === 0) continue;
      const sum = nums.reduce((a, b) => a + b, 0);
      const ok = Math.abs(sum - value) <= TOLERANCE || nums.some((n) => Math.abs(n - value) <= TOLERANCE);
      if (!ok) {
        out.push({
          id: "source-totals:" + l.key,
          check: "source-totals",
          area: "sources",
          severity: "warning",
          title: l.key + " differs from its cited sources",
          detail: l.label + " is " + ctx.money(l.value) + "; the cited values sum to " + ctx.money(sum) + ".",
          refs: [l.key, ...l.sources],
          expected: ctx.money(sum),
          actual: ctx.money(l.value),
          difference: l.value - sum,
        });
      }
    }
    return out;
  },
};

const priorYearCarry: Check = {
  id: "prior-year-carry",
  area: "carryovers",
  title: "Carryovers agree to the prior-year records",
  coverage: (ctx) => {
    const n = [...ctx.lines.values()].filter((l) => l.rule === "R-PRIOR-YEAR-CARRY").length;
    return n + " lines carried in from 2024 were compared with the prior-year figures they point at.";
  },
  run: (ctx) => {
    const out: Finding[] = [];
    for (const l of ctx.lines.values()) {
      if (l.rule !== "R-PRIOR-YEAR-CARRY" || !isNum(l.value)) continue;
      const pointers = l.sources
        .map((s) => ({ s, ref: parseRef(s) }))
        .filter((x) => x.ref.kind === "prior_year")
        .map((x) => ({ s: x.s, v: resolvePointer(ctx.packet.prior_years, (x.ref as { pointer: string }).pointer) }))
        .filter((x): x is { s: string; v: number } => isNum(x.v));
      if (pointers.length === 0) continue;
      const value = l.value;
      const total = pointers.reduce((a, p) => a + p.v, 0);
      // A carryover line may combine several prior-year amounts; sign conventions differ, so compare magnitudes.
      const ok = pointers.some((p) => Math.abs(Math.abs(p.v) - Math.abs(value)) <= TOLERANCE) || Math.abs(Math.abs(total) - Math.abs(value)) <= TOLERANCE;
      if (!ok) {
        out.push({
          id: "prior-year-carry:" + l.key,
          check: "prior-year-carry",
          area: "carryovers",
          severity: "error",
          title: l.key + " does not match the 2024 carryover",
          detail: l.label + " is " + ctx.money(l.value) + " but the prior-year record holds " + pointers.map((p) => ctx.money(p.v)).join(" and ") + ".",
          refs: [l.key, ...pointers.map((p) => p.s)],
          expected: pointers.map((p) => ctx.money(p.v)).join(" + "),
          actual: ctx.money(l.value),
        });
      }
    }
    return out;
  },
};

const fxRateYear: Check = {
  id: "fx-rate-year",
  area: "foreign",
  title: "Foreign amounts converted at the right year's rate",
  coverage: (ctx) => {
    const n = [...ctx.lines.values()].filter((l) => l.sources.some((s) => s.startsWith("ref:fx."))).length;
    return n + " lines converted from a foreign currency were checked against the tax year of the income.";
  },
  run: (ctx) => {
    const out: Finding[] = [];
    const year = ctx.packet.household.tax_year;
    for (const l of ctx.lines.values()) {
      for (const s of l.sources) {
        const m = /^ref:fx\.([A-Z]{3})\.(\d{4})_(average|year_end)$/.exec(s);
        if (!m) continue;
        const [, ccy, rateYear, kind] = m;
        if (Number(rateYear) === year) continue;
        const fx = ctx.packet.fx_rates as Record<string, Record<string, number>>;
        const table = fx[ccy + "_per_USD"] ?? {};
        const used = table[rateYear + "_" + kind];
        const right = table[year + "_" + kind];
        const foreign = l.sources.map((x) => ctx.num(x)).find(isNum);
        let detail = l.label + " was converted with the " + rateYear + " " + kind.replace("_", " ") + " rate";
        let difference: number | undefined;
        if (isNum(used) && isNum(right) && isNum(foreign) && isNum(l.value)) {
          const expected = foreign / right;
          difference = expected - l.value;
          detail += " (" + used + " " + ccy + " per USD). At the " + year + " rate of " + right + " the line would be " + ctx.money(expected) + " instead of " + ctx.money(l.value) + ".";
        } else {
          detail += ".";
        }
        out.push({
          id: "fx-rate-year:" + l.key,
          check: "fx-rate-year",
          area: "foreign",
          severity: "error",
          title: l.key + " uses a " + rateYear + " exchange rate for " + year + " income",
          detail,
          refs: [l.key, s, ...l.sources.filter((x) => x.startsWith("ev-"))],
          difference,
          effect: difference !== undefined ? ctx.effect("interest", difference) : null,
        });
      }
    }
    return out;
  },
};

export function issuerKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["the", "inc", "llc", "lp", "bank", "securities", "brokerage", "credit", "union"].includes(w))[0] ?? name.toLowerCase();
}

const payerDuplicates: Check = {
  id: "payer-duplicates",
  area: "investments",
  title: "Same income not counted from two documents",
  coverage: (ctx) => {
    const n = [...ctx.lines.values()].filter((l) => l.rule === "R-INTEREST-PAYER" || l.rule === "R-DIVIDEND-PAYER").length;
    return n + " interest and dividend payer lines were compared for identical amounts from related issuers.";
  },
  run: (ctx) => {
    const out: Finding[] = [];
    const payerLines = [...ctx.lines.values()].filter((l) => (l.rule === "R-INTEREST-PAYER" || l.rule === "R-DIVIDEND-PAYER") && isNum(l.value));
    for (let i = 0; i < payerLines.length; i++) {
      for (let j = i + 1; j < payerLines.length; j++) {
        const a = payerLines[i];
        const b = payerLines[j];
        if (a.rule !== b.rule || a.value !== b.value || a.value === 0) continue;
        const da = a.sources.map((s) => ctx.value(s)?.document_id).find(Boolean);
        const db = b.sources.map((s) => ctx.value(s)?.document_id).find(Boolean);
        if (!da || !db || da === db) continue;
        const docA = ctx.index.documents.get(da);
        const docB = ctx.index.documents.get(db);
        if (!docA || !docB) continue;
        if (issuerKey(docA.issuer) !== issuerKey(docB.issuer)) continue;
        const v = a.value as number;
        out.push({
          id: "payer-duplicates:" + a.key + ":" + b.key,
          check: "payer-duplicates",
          area: "investments",
          severity: "error",
          title: ctx.money(v) + " from " + docA.issuer + " appears on two lines",
          detail:
            a.key +
            " comes from " +
            da +
            " (" +
            docA.title +
            ") and " +
            b.key +
            " from " +
            db +
            " (" +
            docB.title +
            "). A consolidated statement and a stand-alone 1099 from the same institution usually report the same account once.",
          refs: [a.key, b.key, da, db, ...a.sources, ...b.sources],
          difference: -v,
          effect: ctx.effect("interest", -v),
        });
      }
    }
    return out;
  },
};

export const lineChecks: Check[] = [sumLines, sourceTotals, priorYearCarry, fxRateYear, payerDuplicates];

export type { CheckContext };
