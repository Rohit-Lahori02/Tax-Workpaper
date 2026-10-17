import type { Ledger } from "@/lib/facts/ledger";
import type { FactView } from "@/lib/facts/types";
import type { Packet } from "@/lib/packet/schema";

/**
 * The firm's standards as data the firm can change. The packet ships a
 * starting point; every change is a `standard` fact (target standard:<key>)
 * and the latest live one wins. `applyStandards` returns a packet whose
 * firm section reflects the overrides, so every rule in the app that reads
 * `packet.firm` picks them up without knowing where they came from. Pure.
 */

export type StandardKind = "list" | "number" | "percent" | "hours";

export interface StandardDef {
  key: string;
  label: string;
  kind: StandardKind;
  description: string;
  /** Where the value is used, in plain words. */
  usedBy: string;
  /** False for standards the app enforces structurally and cannot take from the editor. */
  editable: boolean;
}

export const STANDARD_DEFS: StandardDef[] = [
  { key: "verification_types", label: "Verification types", kind: "list", description: "The ways a line may be verified. One per line.", usedBy: "The verify form on every line and the bulk verify on the return.", editable: true },
  { key: "variance_percent", label: "Variance flag: percent", kind: "percent", description: "Flag a line that moved more than this percent against the prior year.", usedBy: "Prior-year swing flags on the return and the judgment page.", editable: true },
  { key: "variance_amount", label: "Variance flag: amount", kind: "number", description: "And moved more than this many dollars. Both must be crossed.", usedBy: "Prior-year swing flags on the return and the judgment page.", editable: true },
  { key: "partner_threshold", label: "Partner approval threshold", kind: "number", description: "Any adjustment with a federal or state tax effect over this amount needs a partner's approval.", usedBy: "The adjustment form, partner approvals and the filing gates.", editable: true },
  { key: "required_steps", label: "Required steps", kind: "list", description: "The checklist a return must finish before it files. Steps the app can compute are ticked by it; the rest are ticked by a person.", usedBy: "The completeness board and the required-steps filing gate.", editable: true },
  { key: "rules", label: "Firm rules", kind: "list", description: "The written standards. Changing the partner threshold above rewrites the matching rule.", usedBy: "Shown wherever a rule is applied.", editable: true },
  { key: "review_levels", label: "Review levels", kind: "list", description: "Sign-off levels in order. Enforced structurally with the no-self-review rule.", usedBy: "The sign-off matrix and every filing gate.", editable: false },
  { key: "budget_hours", label: "Budget hours by area", kind: "hours", description: "Hours budgeted for each area of the return.", usedBy: "Time vs budget on the status dashboard.", editable: true },
];

export const standardTarget = (key: string) => "standard:" + key;

export function standardOverrides(ledger: Ledger): Map<string, FactView> {
  const out = new Map<string, FactView>();
  for (const def of STANDARD_DEFS) {
    const f = ledger.latest(standardTarget(def.key), "standard");
    if (f) out.set(def.key, f);
  }
  return out;
}

type Standards = Packet["firm"]["starter_standards"];

export function starterValue(packet: Packet, key: string): unknown {
  const s = packet.firm.starter_standards;
  switch (key) {
    case "verification_types":
      return s.verification_types;
    case "variance_percent":
      return s.variance_review.flag_if_change_over_percent;
    case "variance_amount":
      return s.variance_review.and_over_amount;
    case "partner_threshold":
      return thresholdFromRules(s.rules);
    case "required_steps":
      return s.required_steps;
    case "rules":
      return s.rules;
    case "review_levels":
      return s.review_levels;
    case "budget_hours":
      return packet.firm.budget_hours;
    default:
      return undefined;
  }
}

export function thresholdFromRules(rules: string[]): number {
  const rule = rules.find((r) => /partner sign-off/i.test(r));
  const m = rule ? /over ([\d,]+)/.exec(rule) : null;
  return m ? Number(m[1].replace(/,/g, "")) : 1000;
}

/** Validates and normalizes a submitted value for a standard. Throws with a readable message. */
export function parseStandardValue(def: StandardDef, raw: string): unknown {
  const t = raw.trim();
  if (def.kind === "list") {
    const items = t
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!items.length) throw new Error("Give at least one item, one per line.");
    if (def.key === "verification_types" && items.some((x) => !/^[a-z0-9_]+$/.test(x))) throw new Error("Verification types are lowercase words joined by underscores, for example agreed_to_source_document.");
    return [...new Set(items)];
  }
  if (def.kind === "hours") {
    const out: Record<string, number> = {};
    for (const line of t.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const m = /^([a-z0-9_]+)\s*[:=]\s*([\d.]+)$/.exec(line.trim());
      if (!m) throw new Error('Budget lines look like "business: 3.5".');
      out[m[1]] = Number(m[2]);
    }
    if (!Object.keys(out).length) throw new Error("Give at least one area.");
    return out;
  }
  const n = Number(t.replace(/[,$%\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new Error("Enter a number of zero or more.");
  if (def.kind === "percent" && n > 1000) throw new Error("A percent over 1,000 would never flag anything.");
  return n;
}

export function formatStandardValue(def: StandardDef, value: unknown): string {
  if (def.kind === "list") return Array.isArray(value) ? value.map(String).join("\n") : "";
  if (def.kind === "hours") return value && typeof value === "object" ? Object.entries(value as Record<string, number>).map(([k, v]) => k + ": " + v).join("\n") : "";
  return value === undefined || value === null ? "" : String(value);
}

export interface StandardView {
  def: StandardDef;
  starter: unknown;
  current: unknown;
  override: FactView | null;
}

export function standardsView(packet: Packet, ledger: Ledger): StandardView[] {
  const overrides = standardOverrides(ledger);
  const eff = applyStandards(packet, ledger);
  return STANDARD_DEFS.map((def) => {
    const o = overrides.get(def.key) ?? null;
    // Current values come from the applied packet, so a threshold change also shows in the rewritten rule.
    return { def, starter: starterValue(packet, def.key), current: starterValue(eff, def.key), override: def.editable ? o : null };
  });
}

/** The packet with the firm's current standards in place of the starter ones. The packet object itself is never mutated. */
export function applyStandards(packet: Packet, ledger: Ledger): Packet {
  const overrides = standardOverrides(ledger);
  if (overrides.size === 0) return packet;
  const s: Standards = { ...packet.firm.starter_standards, variance_review: { ...packet.firm.starter_standards.variance_review } };
  let budget = packet.firm.budget_hours;
  const val = (k: string) => overrides.get(k)?.body.value;
  const list = (k: string): string[] | undefined => (Array.isArray(val(k)) ? (val(k) as unknown[]).map(String) : undefined);
  const num = (k: string): number | undefined => (typeof val(k) === "number" ? (val(k) as number) : undefined);

  const vt = list("verification_types");
  if (vt) s.verification_types = vt;
  const vp = num("variance_percent");
  if (vp !== undefined) s.variance_review.flag_if_change_over_percent = vp;
  const va = num("variance_amount");
  if (va !== undefined) s.variance_review.and_over_amount = va;
  const steps = list("required_steps");
  if (steps) s.required_steps = steps;
  const rules = list("rules");
  if (rules) s.rules = rules;
  const pt = num("partner_threshold");
  if (pt !== undefined) {
    s.rules = s.rules.map((r) => (/partner sign-off/i.test(r) ? r.replace(/over [\d,]+/, "over " + pt.toLocaleString("en-US")) : r));
    if (!s.rules.some((r) => /partner sign-off/i.test(r))) s.rules = [...s.rules, "Any adjustment with a tax effect over " + pt.toLocaleString("en-US") + " (federal or state) requires partner sign-off."];
  }
  const bh = val("budget_hours");
  if (bh && typeof bh === "object") budget = { ...budget, ...(bh as Record<string, number>) };

  return { ...packet, firm: { ...packet.firm, starter_standards: s, budget_hours: budget } };
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

export interface TimeEntry {
  fact: FactView;
  area: string;
  hours: number;
  date: string;
  actorId: string;
  actorName: string;
  text: string | null;
}

export function timeEntries(ledger: Ledger): TimeEntry[] {
  return ledger.all
    .filter((f) => f.kind === "time" && !f.retracted && typeof f.body.hours === "number")
    .map((f) => ({ fact: f, area: f.target.replace(/^area:/, ""), hours: f.body.hours as number, date: String(f.body.date ?? f.at.slice(0, 10)), actorId: f.actorId, actorName: f.actorName, text: typeof f.body.text === "string" ? f.body.text : null }));
}

export interface AreaTime {
  area: string;
  budget: number;
  logged: number;
  byPerson: { actorId: string; name: string; hours: number }[];
}

export function timeByArea(packet: Packet, ledger: Ledger): AreaTime[] {
  const entries = timeEntries(ledger);
  const areas = Object.keys(packet.firm.budget_hours);
  for (const e of entries) if (!areas.includes(e.area)) areas.push(e.area);
  return areas.map((area) => {
    const mine = entries.filter((e) => e.area === area);
    const people = new Map<string, { actorId: string; name: string; hours: number }>();
    for (const e of mine) {
      const p = people.get(e.actorId) ?? { actorId: e.actorId, name: e.actorName, hours: 0 };
      p.hours += e.hours;
      people.set(e.actorId, p);
    }
    return { area, budget: packet.firm.budget_hours[area] ?? 0, logged: Math.round(mine.reduce((s, e) => s + e.hours, 0) * 100) / 100, byPerson: [...people.values()] };
  });
}
