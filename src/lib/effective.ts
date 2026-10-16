import type { Ledger } from "@/lib/facts/ledger";
import type { FactView } from "@/lib/facts/types";
import type { PacketIndex } from "@/lib/packet/index";
import type { Packet, ReturnLine, ReturnVersion } from "@/lib/packet/schema";

/**
 * The working return: the engine's latest version with every active
 * adjustment applied and pushed through the arithmetic lines that depend on
 * it. Pure over packet + ledger; nothing is stored.
 */

export type EffectCategory =
  | "wages"
  | "interest"
  | "schc_profit"
  | "stcg"
  | "ltcg"
  | "ordinary_income"
  | "adjustment"
  | "salt"
  | "itemized"
  | "ca_source_income"
  | "payment_federal"
  | "payment_california"
  | "credit_federal"
  | "credit_california";

export const CATEGORY_LABELS: Record<EffectCategory, string> = {
  wages: "Wages",
  interest: "Interest and dividends",
  schc_profit: "Schedule C profit",
  stcg: "Short-term capital gain",
  ltcg: "Long-term capital gain",
  ordinary_income: "Other ordinary income",
  adjustment: "Adjustment to income",
  salt: "State and local taxes",
  itemized: "Other itemized deduction",
  ca_source_income: "California-source income only",
  payment_federal: "Federal payment (1:1 on balance due)",
  payment_california: "California payment (1:1 on balance)",
  credit_federal: "Federal credit (1:1 on tax)",
  credit_california: "California credit (1:1 on tax)",
};

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as EffectCategory[];

export interface Effect {
  /** Change in federal balance due if the adjustment is made. */
  federal: number;
  /** Change in California balance due. */
  california: number;
  /** False for payments, which move the balance but not the tax. */
  affectsTax: boolean;
}

const FEDERAL_PAYMENT_KEYS = new Set(["F1040.25a", "F1040.25c", "F1040.25d", "F1040.26", "Sch3.10", "Sch3.11", "Sch3.15", "F1040.31", "F1040.33"]);
const CA_PAYMENT_KEYS = new Set(["F540NR.71", "F540NR.72", "F540NR.73", "F540NR.78"]);

export function categoryFor(key: string, line?: ReturnLine): EffectCategory {
  if (FEDERAL_PAYMENT_KEYS.has(key)) return "payment_federal";
  if (CA_PAYMENT_KEYS.has(key)) return "payment_california";
  if (/^(F8812|F8863|F2441|Sch3\.[1-8]$)/.test(key)) return "credit_federal";
  if (/^F540NR\.(39|4\d|5\d)$/.test(key) || /^ScheduleS/.test(key)) return "credit_california";
  if (/^(F1040\.1[a-z]?$|SchCA540NR\.1\.)/.test(key)) return "wages";
  if (/^SchB\.|^F1040\.(2b|3[ab])$/.test(key)) return "interest";
  if (/^SchC\.|^Sch1\.3$|^SchSE/.test(key)) return "schc_profit";
  if (/^F8949\.[ABCH]\.|^SchD\.(1b|2|3|6|7)$/.test(key)) return "stcg";
  if (/^F8949\.[DEFK]\.|^SchD\.(8b|9|1\d)$|^F4797/.test(key)) return "ltcg";
  if (/^SchA\.5/.test(key)) return "salt";
  if (/^SchA\.|^F8283/.test(key)) return "itemized";
  if (/^Sch1\.(1[3-9]|2\d)$/.test(key)) return "adjustment";
  if (/^SchCA540NR\..*\.E$|^F540NR/.test(key)) return "ca_source_income";
  if (line?.jurisdiction === "california") return "ca_source_income";
  return "ordinary_income";
}

export type RateTable = Record<string, { federal_per_dollar: number; california_per_dollar: number }>;

export function effectFor(category: EffectCategory, delta: number, version: ReturnVersion): Effect {
  return effectFromRates(category, delta, version.tax_effect_rates);
}

/** Same as effectFor, for callers (including the browser) that only hold the rate table. */
export function effectFromRates(category: EffectCategory, delta: number, rates: RateTable): Effect {
  switch (category) {
    case "payment_federal":
      return { federal: -Math.round(delta), california: 0, affectsTax: false };
    case "payment_california":
      return { federal: 0, california: -Math.round(delta), affectsTax: false };
    case "credit_federal":
      return { federal: -Math.round(delta), california: 0, affectsTax: true };
    case "credit_california":
      return { federal: 0, california: -Math.round(delta), affectsTax: true };
    default: {
      const r = rates[category];
      if (!r) return { federal: 0, california: 0, affectsTax: true };
      return { federal: Math.round(r.federal_per_dollar * delta), california: Math.round(r.california_per_dollar * delta), affectsTax: true };
    }
  }
}

/** The dollar threshold in the firm's "requires partner sign-off" rule. */
export function partnerThreshold(packet: Packet): number {
  const rule = packet.firm.starter_standards.rules.find((r) => /partner sign-off/i.test(r));
  const m = rule ? /over ([\d,]+)/.exec(rule) : null;
  return m ? Number(m[1].replace(/,/g, "")) : 1000;
}

/** Firm rule: any adjustment with a tax effect over 1,000 (federal or state) requires partner sign-off. */
export function requiresPartner(effect: Effect, packet: Packet): boolean {
  const threshold = partnerThreshold(packet);
  return Math.abs(effect.federal) > threshold || Math.abs(effect.california) > threshold;
}

export interface AdjustmentView {
  factId: string;
  seq: number;
  key: string;
  engineValue: number;
  newValue: number;
  delta: number;
  reason: string;
  authority: string | null;
  category: EffectCategory;
  effect: Effect;
  requiresPartner: boolean;
  fromFinding: string | null;
  whatIf: string | null;
  batchId: string | null;
  actorId: string;
  actorName: string;
  at: string;
}

function num(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

export function adjustmentFromFact(f: FactView): AdjustmentView | null {
  if (f.kind !== "adjustment") return null;
  const b = f.body;
  const newValue = num(b.newValue);
  const engineValue = num(b.engineValue);
  if (newValue === null || engineValue === null) return null;
  const eff = (b.effect ?? {}) as Record<string, unknown>;
  return {
    factId: f.id,
    seq: f.seq,
    key: f.target,
    engineValue,
    newValue,
    delta: num(b.delta) ?? newValue - engineValue,
    reason: String(b.reason ?? ""),
    authority: typeof b.authority === "string" && b.authority ? b.authority : null,
    category: (CATEGORIES.includes(b.category as EffectCategory) ? b.category : "ordinary_income") as EffectCategory,
    effect: { federal: num(eff.federal) ?? 0, california: num(eff.california) ?? 0, affectsTax: eff.affectsTax !== false },
    requiresPartner: b.requiresPartner === true,
    fromFinding: typeof b.fromFinding === "string" ? b.fromFinding : null,
    whatIf: typeof b.whatIf === "string" ? b.whatIf : null,
    batchId: f.batchId,
    actorId: f.actorId,
    actorName: f.actorName,
    at: f.at,
  };
}

/** Active (not retracted) adjustments, oldest first. The latest adjustment on a line wins. */
export function activeAdjustments(ledger: Ledger): AdjustmentView[] {
  return ledger.all.filter((f) => f.kind === "adjustment" && !f.retracted).map(adjustmentFromFact).filter((a): a is AdjustmentView => a !== null);
}

export type EffectiveKind = "adjusted" | "derived" | "blocked";

export interface EffectiveLine {
  key: string;
  engine: number | string;
  working: number | string;
  delta: number;
  kind: EffectiveKind;
  /** For adjusted lines, the adjustments applied (latest last). */
  adjustments: AdjustmentView[];
}

export interface EffectiveSummary {
  total_tax: number;
  balance_due: number;
  payments: number;
}

export interface EffectiveReturn {
  version: string;
  adjustments: AdjustmentView[];
  /** Only lines that differ from the engine, or that could not be recomputed. */
  lines: Map<string, EffectiveLine>;
  changed: EffectiveLine[];
  blocked: EffectiveLine[];
  effect: { federal: number; california: number; federalTax: number; californiaTax: number };
  engineSummary: { federal: EffectiveSummary; california: EffectiveSummary };
  workingSummary: { federal: EffectiveSummary; california: EffectiveSummary };
  /** Working value for any key, falling back to the engine. */
  value(key: string): number | string | undefined;
}

/** Signs that reproduce the engine's value from its inputs, or null when none does. */
export function findSigns(inputs: number[], value: number): number[] | null {
  if (inputs.length === 0 || inputs.length > 12) return null;
  const n = inputs.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += mask & (1 << i) ? -inputs[i] : inputs[i];
    if (Math.abs(sum - value) <= 1) return Array.from({ length: n }, (_, i) => (mask & (1 << i) ? -1 : 1));
  }
  return null;
}

export function effectiveReturn(packet: Packet, index: PacketIndex, ledger: Ledger, versionId = index.latestVersion): EffectiveReturn {
  const version = index.versions.get(versionId)!;
  const lines = index.lines.get(versionId)!;
  const deps = index.dependents.get(versionId) ?? new Map<string, string[]>();
  const adjustments = activeAdjustments(ledger).filter((a) => lines.has(a.key));
  const result = new Map<string, EffectiveLine>();
  const working = new Map<string, number | string>();

  const byKey = new Map<string, AdjustmentView[]>();
  for (const a of adjustments) byKey.set(a.key, [...(byKey.get(a.key) ?? []), a]);
  const queue: string[] = [];
  for (const [key, list] of byKey) {
    const line = lines.get(key)!;
    const latest = list[list.length - 1];
    working.set(key, latest.newValue);
    result.set(key, { key, engine: line.value, working: latest.newValue, delta: typeof line.value === "number" ? latest.newValue - line.value : 0, kind: "adjusted", adjustments: list });
    queue.push(key);
  }

  const get = (k: string): number | string | undefined => working.get(k) ?? lines.get(k)?.value;
  const seen = new Set<string>();
  while (queue.length) {
    const k = queue.shift()!;
    for (const d of deps.get(k) ?? []) {
      if (byKey.has(d)) continue; // an explicit adjustment overrides derivation
      const line = lines.get(d);
      if (!line || typeof line.value !== "number") continue;
      if (line.rule === "R-SUM" || line.rule === "R-CARRY") {
        const engineInputs = line.inputs.map((i) => lines.get(i)?.value).map((v) => (typeof v === "number" ? v : 0));
        const workingInputs = line.inputs.map((i) => get(i)).map((v) => (typeof v === "number" ? v : 0));
        const signs = findSigns(engineInputs, line.value);
        let next: number;
        if (signs) next = workingInputs.reduce((s, v, i) => s + signs[i] * v, 0);
        else next = line.value + workingInputs.reduce((s, v, i) => s + (v - engineInputs[i]), 0);
        next = Math.round(next * 100) / 100;
        const prev = working.get(d);
        if (prev === next) continue;
        if (Math.abs(next - line.value) < 0.005) {
          working.delete(d);
          result.delete(d);
        } else {
          working.set(d, next);
          result.set(d, { key: d, engine: line.value, working: next, delta: next - line.value, kind: "derived", adjustments: [] });
        }
        if (!seen.has(d + ":" + next)) {
          seen.add(d + ":" + next);
          queue.push(d);
        }
      } else if (!result.has(d)) {
        // A computation the engine owns (tax tables, limits). Its inputs moved; the effect is estimated by rate instead.
        result.set(d, { key: d, engine: line.value, working: line.value, delta: 0, kind: "blocked", adjustments: [] });
      }
    }
  }

  const effect = adjustments.reduce(
    (acc, a) => ({
      federal: acc.federal + a.effect.federal,
      california: acc.california + a.effect.california,
      federalTax: acc.federalTax + (a.effect.affectsTax ? a.effect.federal : 0),
      californiaTax: acc.californiaTax + (a.effect.affectsTax ? a.effect.california : 0),
    }),
    { federal: 0, california: 0, federalTax: 0, californiaTax: 0 },
  );
  const payDelta = (cat: EffectCategory) => adjustments.filter((a) => a.category === cat).reduce((s, a) => s + a.delta, 0);
  const engineSummary = {
    federal: { total_tax: version.summary.federal.total_tax, balance_due: version.summary.federal.balance_due, payments: version.summary.federal.payments },
    california: { total_tax: version.summary.california.total_tax, balance_due: version.summary.california.balance_due, payments: version.summary.california.payments },
  };
  const workingSummary = {
    federal: {
      total_tax: engineSummary.federal.total_tax + effect.federalTax,
      balance_due: engineSummary.federal.balance_due + effect.federal,
      payments: engineSummary.federal.payments + payDelta("payment_federal"),
    },
    california: {
      total_tax: engineSummary.california.total_tax + effect.californiaTax,
      balance_due: engineSummary.california.balance_due + effect.california,
      payments: engineSummary.california.payments + payDelta("payment_california"),
    },
  };
  const all = [...result.values()];
  return {
    version: versionId,
    adjustments,
    lines: result,
    changed: all.filter((l) => l.kind !== "blocked"),
    blocked: all.filter((l) => l.kind === "blocked"),
    effect,
    engineSummary,
    workingSummary,
    value: get,
  };
}

/** Facts newer than the actor's last "seen" marker, excluding housekeeping kinds and the actor's own records. */
export function lastSeenSeq(ledger: Ledger, actorId: string): number {
  let seq = 0;
  for (const f of ledger.all) {
    if (f.kind === "seen" && f.actorId === actorId) {
      const s = num(f.body.seq);
      if (s !== null && s > seq) seq = s;
    }
  }
  return seq;
}

export function factsSince(ledger: Ledger, seq: number, excludeActor?: string): FactView[] {
  return ledger.all.filter((f) => f.seq > seq && f.kind !== "seen" && f.kind !== "sensitive_view" && f.actorId !== excludeActor);
}
