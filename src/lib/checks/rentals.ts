import type { VersionAsset } from "@/lib/packet/schema";
import type { Check, CheckContext, Finding } from "./types";

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function n(obj: Record<string, unknown> | undefined, key: string): number | null {
  const v = obj?.[key];
  return isNum(v) ? v : null;
}

/** Months of service in the year for a straight-line, mid-month asset. */
function midMonthMonths(asset: VersionAsset, year: number): number {
  const placed = asset.placed_in_service;
  const disposed = typeof asset.disposed === "string" ? asset.disposed : null;
  const start = placed.startsWith(String(year)) ? Number(placed.slice(5, 7)) : null;
  const end = disposed && disposed.startsWith(String(year)) ? Number(disposed.slice(5, 7)) : null;
  if (start !== null && end !== null) return end - start;
  if (start !== null) return 12 - start + 0.5;
  if (end !== null) return end - 1 + 0.5;
  return 12;
}

export function expectedStraightLine(asset: VersionAsset, year: number): number | null {
  if (!/^SL/i.test(asset.method)) return null;
  const annual = asset.cost / asset.life_years;
  return (annual * midMonthMonths(asset, year)) / 12;
}

const depreciationRollforward: Check = {
  id: "depreciation",
  area: "rentals",
  title: "Depreciation rolls forward and straight-line amounts recompute",
  coverage: (ctx) => ctx.version.assets.length + " assets were checked: prior accumulated depreciation against the year-by-year records, this year's straight-line amount against cost, life and mid-month convention, and ending accumulated totals.",
  run: (ctx) => {
    const out: Finding[] = [];
    const year = ctx.packet.household.tax_year;
    for (const a of ctx.version.assets) {
      const prior = ctx.index.priorAssets.get(a.asset_id);
      const ref = "asset:" + a.asset_id;
      for (const j of ["federal", "california"] as const) {
        const book = a[j] as Record<string, unknown>;
        const priorAcc = n(book, "prior_accumulated");
        const dep = n(book, "depreciation_2025") ?? n(book, "depreciation_" + year);
        const endAcc = n(book, "accumulated_end");
        if (prior && priorAcc !== null) {
          const recordSum = Object.values(prior[j]).reduce((x, y) => x + y, 0);
          if (Math.abs(recordSum - priorAcc) > 0.5) {
            out.push({
              id: "depreciation:" + a.asset_id + ":" + j + ":prior",
              check: "depreciation",
              area: "rentals",
              severity: "error",
              title: a.asset_id + " " + j + " prior depreciation " + ctx.money(priorAcc) + " vs records " + ctx.money(recordSum),
              detail: "The year-by-year prior records for " + a.description + " sum to " + ctx.money(recordSum) + ".",
              refs: [ref, "py:/asset_records"],
              expected: ctx.money(recordSum),
              actual: ctx.money(priorAcc),
            });
          }
        }
        if (priorAcc !== null && dep !== null && endAcc !== null && Math.abs(priorAcc + dep - endAcc) > 0.5) {
          out.push({
            id: "depreciation:" + a.asset_id + ":" + j + ":end",
            check: "depreciation",
            area: "rentals",
            severity: "error",
            title: a.asset_id + " " + j + " accumulated total does not roll forward",
            detail: ctx.money(priorAcc) + " plus " + ctx.money(dep) + " is not " + ctx.money(endAcc) + ".",
            refs: [ref],
          });
        }
        if (j === "federal" && dep !== null) {
          const expected = expectedStraightLine(a, year);
          if (expected !== null && Math.abs(expected - dep) > 2) {
            out.push({
              id: "depreciation:" + a.asset_id + ":sl",
              check: "depreciation",
              area: "rentals",
              severity: "error",
              title: a.asset_id + " depreciation " + ctx.money(dep) + " vs straight-line " + ctx.money(expected),
              detail:
                "Cost " +
                ctx.money(a.cost) +
                " over " +
                a.life_years +
                " years, mid-month, " +
                midMonthMonths(a, year) +
                " months in service this year.",
              refs: [ref],
              expected: ctx.money(expected),
              actual: ctx.money(dep),
              difference: expected - dep,
            });
          }
        }
      }
    }
    return out;
  },
};

const scheduleEDepreciation: Check = {
  id: "schedule-e-depreciation",
  area: "rentals",
  title: "Schedule E depreciation equals the asset schedule by property",
  coverage: (ctx) => [...ctx.lines.values()].filter((l) => /^SchE\.18[A-Z]$/.test(l.key)).length + " Schedule E depreciation lines were re-added from the per-asset federal amounts for that property, and the Form 4797 depreciation-allowed figure from the disposed assets.",
  run: (ctx) => {
    const out: Finding[] = [];
    const props = [...ctx.lines.values()].filter((l) => /^SchE\.1[A-Z]$/.test(l.key) && typeof l.value === "string");
    for (const p of props) {
      const col = p.key.slice(-1);
      const line = ctx.line("SchE.18" + col);
      if (!line || !isNum(line.value)) continue;
      const address = String(p.value).split(",")[0].trim().toLowerCase();
      const assets = ctx.version.assets.filter((a) => a.activity.toLowerCase().includes(address));
      if (assets.length === 0) continue;
      const sum = assets.reduce((x, a) => x + (n(a.federal as Record<string, unknown>, "depreciation_2025") ?? 0), 0);
      if (Math.abs(sum - line.value) > 1) {
        out.push({
          id: "schedule-e-depreciation:" + line.key,
          check: "schedule-e-depreciation",
          area: "rentals",
          severity: "error",
          title: line.key + " " + ctx.money(line.value) + " vs assets " + ctx.money(sum),
          detail: "Assets for " + p.value + ": " + assets.map((a) => a.asset_id).join(", ") + ".",
          refs: [line.key, ...assets.map((a) => "asset:" + a.asset_id)],
          expected: ctx.money(sum),
          actual: ctx.money(line.value),
        });
      }
    }
    const allowed = ctx.line("F4797.23");
    if (allowed && isNum(allowed.value)) {
      const disposed = ctx.version.assets.filter((a) => a.disposed);
      const sum = disposed.reduce((x, a) => x + (n(a.federal as Record<string, unknown>, "accumulated_end") ?? 0), 0);
      if (disposed.length && Math.abs(sum - allowed.value) > 1) {
        out.push({
          id: "schedule-e-depreciation:F4797.23",
          check: "schedule-e-depreciation",
          area: "rentals",
          severity: "error",
          title: "Depreciation allowed on the sale " + ctx.money(allowed.value) + " vs disposed assets " + ctx.money(sum),
          detail: "Disposed assets: " + disposed.map((a) => a.asset_id + " " + ctx.money(n(a.federal as Record<string, unknown>, "accumulated_end") ?? 0)).join(", ") + ".",
          refs: ["F4797.23", ...disposed.map((a) => "asset:" + a.asset_id)],
        });
      }
    }
    return out;
  },
};

const rentAgreement: Check = {
  id: "rent-agreement",
  area: "rentals",
  title: "Rents received agree between the ledger and the information return",
  coverage: (ctx) => [...ctx.lines.values()].filter((l) => /^SchE\.3[A-Z]$/.test(l.key)).length + " rent lines were compared across every source they cite (owner statement, ledger, Form 1099-MISC).",
  run: (ctx) => {
    const out: Finding[] = [];
    for (const l of ctx.lines.values()) {
      if (!/^SchE\.3[A-Z]$/.test(l.key) || !isNum(l.value)) continue;
      const nums = l.sources.map((s) => ({ s, v: ctx.num(s) })).filter((x) => x.v !== null) as { s: string; v: number }[];
      if (nums.length < 2) continue;
      const distinct = [...new Set(nums.map((x) => Math.round(x.v)))];
      if (distinct.length > 1) {
        out.push({
          id: "rent-agreement:" + l.key,
          check: "rent-agreement",
          area: "rentals",
          severity: "error",
          title: l.key + " sources disagree: " + distinct.map((d) => ctx.money(d)).join(" vs "),
          detail: nums.map((x) => x.s + " " + ctx.money(x.v)).join(", "),
          refs: [l.key, ...l.sources],
        });
      }
    }
    return out;
  },
};

export const rentalChecks: Check[] = [depreciationRollforward, scheduleEDepreciation, rentAgreement];

export type { CheckContext };
