import { createHash } from "node:crypto";
import type { CheckRun } from "@/lib/checks/run";
import { AREA_DEFS } from "@/lib/completeness";
import type { StepStatus } from "@/lib/completeness";
import { activeAdjustments, type AdjustmentView, type EffectiveReturn } from "@/lib/effective";
import type { Ledger } from "@/lib/facts/ledger";
import type { FactView } from "@/lib/facts/types";
import type { PacketIndex } from "@/lib/packet/index";
import type { Packet } from "@/lib/packet/schema";
import type { Actor } from "@/lib/roles";

/**
 * Sign-offs, approvals, assignments and filing gates. A sign-off stores a hash
 * of everything inside its scope at the moment of signing; the moment anything
 * in that scope changes, the hash no longer matches and the sign-off shows as
 * reopened. Pure over packet + ledger; hashing uses Node's crypto.
 */

export interface Scope {
  id: string;
  label: string;
  /** Line keys inside the scope. */
  lines: string[];
  /** Document ids inside the scope. */
  documents: string[];
  /** Any other targets (check findings, decisions) inside the scope. */
  other: string[];
}

const EXCLUDED_FROM_HASH = new Set(["signoff", "seen", "sensitive_view", "approval_request", "approval", "assignment", "step", "filing"]);

export function scopes(packet: Packet, index: PacketIndex, checks: CheckRun): Scope[] {
  const lineKeys = [...(index.lines.get(index.latestVersion)?.keys() ?? [])];
  const docs = packet.documents;
  const areaScopes: Scope[] = AREA_DEFS.filter((a) => a.id !== "partner_review").map((a) => ({
    id: "area:" + a.id,
    label: a.label,
    lines: lineKeys.filter((k) => a.match(k)),
    documents: docs.filter((d) => a.docTypes.includes(d.document_type)).map((d) => d.id),
    other: checks.findings.filter((f) => a.checkAreas.includes(f.area)).map((f) => "check:" + f.id),
  }));
  const whole: Scope = {
    id: "return",
    label: "Whole return",
    lines: lineKeys,
    documents: docs.map((d) => d.id),
    other: [...checks.findings.map((f) => "check:" + f.id), "decisions"],
  };
  return [...areaScopes, whole];
}

export function scopeById(all: Scope[], id: string): Scope | undefined {
  return all.find((s) => s.id === id);
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export interface ScopeSnapshot {
  hash: string;
  facts: number;
  adjustments: number;
  /** Working values that differ from the engine, inside the scope. */
  lines: Record<string, number | string>;
}

/** Everything a sign-off vouches for, reduced to one hash. */
export function scopeSnapshot(scope: Scope, ledger: Ledger, eff: EffectiveReturn): ScopeSnapshot {
  const targets = new Set<string>([...scope.lines, ...scope.documents, ...scope.other]);
  const whole = scope.id === "return";
  const parts: string[] = [];
  const lines: Record<string, number | string> = {};
  for (const key of scope.lines) {
    const w = eff.lines.get(key);
    if (w && w.kind !== "blocked") lines[key] = w.working;
  }
  for (const [k, v] of Object.entries(lines).sort(([a], [b]) => a.localeCompare(b))) parts.push("L|" + k + "|" + String(v));
  let facts = 0;
  for (const f of ledger.all) {
    if (f.retracted || EXCLUDED_FROM_HASH.has(f.kind) || f.kind === "retract" || f.kind === "resolve" || f.kind === "answer") continue;
    if (!whole && !targets.has(f.target) && !(f.kind === "judgment" && /^(decision|diag|dd|filing|area):/.test(f.target) && scope.id === "return")) {
      if (!targets.has(f.target)) continue;
    }
    facts += 1;
    const resolved = f.kind === "note" ? (f.resolved ? "r" : "o") : "";
    const answers = f.kind === "question" ? String(f.answers.filter((a) => !a.retracted).length) : "";
    parts.push("F|" + f.id + "|" + f.kind + "|" + resolved + answers);
  }
  const adjustments = activeAdjustments(ledger).filter((a) => whole || targets.has(a.key)).length;
  return { hash: sha256(parts.join("\n")), facts, adjustments, lines };
}

export interface SignoffStatus {
  scope: Scope;
  level: string;
  fact: FactView | null;
  state: "missing" | "valid" | "reopened";
  /** What changed since signing, when reopened. */
  changes: { facts: number; lines: string[] };
}

export function signoffStatus(scope: Scope, level: string, ledger: Ledger, snapshot: ScopeSnapshot): SignoffStatus {
  const facts = (ledger.byTarget.get(scope.id) ?? []).filter((f) => f.kind === "signoff" && !f.retracted && f.body.level === level);
  const fact = facts.at(-1) ?? null;
  if (!fact) return { scope, level, fact: null, state: "missing", changes: { facts: 0, lines: [] } };
  const signedHash = String(fact.body.hash ?? "");
  if (signedHash === snapshot.hash) return { scope, level, fact, state: "valid", changes: { facts: 0, lines: [] } };
  const snap = (fact.body.snapshot ?? {}) as { lines?: Record<string, number | string>; facts?: number };
  const before = snap.lines ?? {};
  const changedLines = new Set<string>();
  for (const k of new Set([...Object.keys(before), ...Object.keys(snapshot.lines)])) if (before[k] !== snapshot.lines[k]) changedLines.add(k);
  const targets = new Set<string>([...scope.lines, ...scope.documents, ...scope.other]);
  const newFacts = ledger.all.filter((f) => f.seq > fact.seq && !EXCLUDED_FROM_HASH.has(f.kind) && (scope.id === "return" || targets.has(f.target))).length;
  return { scope, level, fact, state: "reopened", changes: { facts: newFacts, lines: [...changedLines] } };
}

/** People who prepared work inside a scope: authors of verifications, adjustments, judgments or notes there. */
export function preparersOf(scope: Scope, ledger: Ledger): Set<string> {
  const targets = new Set<string>([...scope.lines, ...scope.documents, ...scope.other]);
  const out = new Set<string>();
  for (const f of ledger.all) {
    if (f.retracted) continue;
    if (!["verification", "adjustment", "judgment", "note", "disposition"].includes(f.kind)) continue;
    if (scope.id === "return" || targets.has(f.target)) out.add(f.actorId);
  }
  return out;
}

const LEVEL_ROLES: Record<string, string[]> = {
  preparer: ["preparer", "reviewer", "partner", "quality_reviewer"],
  reviewer: ["reviewer", "partner", "quality_reviewer"],
  partner: ["partner"],
};

export interface SignoffEligibility {
  allowed: boolean;
  reason: string | null;
}

/** Role gate, sequence gate (each level needs the one below valid) and the no-self-review rule. */
export function canSignOff(actor: Actor, scope: Scope, level: string, levels: string[], statuses: SignoffStatus[], ledger: Ledger): SignoffEligibility {
  if (actor.kind !== "staff") return { allowed: false, reason: "Only firm staff sign off." };
  const roles = LEVEL_ROLES[level] ?? [level];
  if (!roles.includes(actor.role)) return { allowed: false, reason: "Your role cannot sign at the " + level + " level." };
  const i = levels.indexOf(level);
  if (i > 0) {
    const below = statuses.find((s) => s.level === levels[i - 1]);
    if (!below || below.state !== "valid") return { allowed: false, reason: "Needs a current " + levels[i - 1] + " sign-off first." };
  }
  if (level !== "preparer" && preparersOf(scope, ledger).has(actor.id)) {
    return { allowed: false, reason: "Firm standard: a person may not review or sign off on work they prepared." };
  }
  return { allowed: true, reason: null };
}

export interface AdjustmentApproval {
  adjustment: AdjustmentView;
  approval: FactView | null;
  state: "not_needed" | "pending" | "approved" | "reopened";
}

export function adjustmentApprovals(ledger: Ledger): AdjustmentApproval[] {
  return activeAdjustments(ledger).map((a) => {
    if (!a.requiresPartner) return { adjustment: a, approval: null, state: "not_needed" as const };
    const target = "fact:" + a.factId;
    const approval = ledger.latest(target, "signoff");
    if (!approval) return { adjustment: a, approval: null, state: "pending" as const };
    const hash = adjustmentHash(a);
    return { adjustment: a, approval, state: approval.body.hash === hash ? ("approved" as const) : ("reopened" as const) };
  });
}

export function adjustmentHash(a: AdjustmentView): string {
  return sha256(["A", a.factId, a.key, String(a.newValue), a.reason, a.category].join("|"));
}

export interface Assignment {
  scope: string;
  role: string;
  assigneeId: string;
  due: string | null;
  fact: FactView | null;
}

/** Current assignment per scope and role: the latest assignment fact, else the firm's starting assignment. */
export function assignments(packet: Packet, ledger: Ledger, scopeIds: string[]): Assignment[] {
  const start = packet.firm.assignment_at_start as Record<string, string>;
  const out: Assignment[] = [];
  for (const scope of scopeIds) {
    for (const role of ["preparer", "reviewer", "partner"]) {
      const facts = (ledger.byTarget.get(scope) ?? []).filter((f) => f.kind === "assignment" && !f.retracted && f.body.role === role);
      const fact = facts.at(-1) ?? null;
      out.push({
        scope,
        role,
        assigneeId: fact ? String(fact.body.assigneeId) : (start[role] ?? ""),
        due: fact && typeof fact.body.due === "string" ? fact.body.due : null,
        fact,
      });
    }
  }
  return out;
}

export interface ApprovalStatus {
  request: FactView | null;
  requestCurrent: boolean;
  signers: { actorId: string; name: string; approval: FactView | null; state: "missing" | "valid" | "reopened" }[];
  complete: boolean;
}

export function approvalStatus(packet: Packet, ledger: Ledger, returnHash: string): ApprovalStatus {
  const request = ledger.latest("return", "approval_request");
  const signers = packet.firm.client_users.map((c) => {
    const approval = (ledger.byTarget.get("return") ?? []).filter((f) => f.kind === "approval" && !f.retracted && f.actorId === c.id).at(-1) ?? null;
    const state = !approval ? ("missing" as const) : approval.body.hash === returnHash ? ("valid" as const) : ("reopened" as const);
    return { actorId: c.id, name: c.name, approval, state };
  });
  return { request, requestCurrent: Boolean(request && request.body.hash === returnHash), signers, complete: signers.every((s) => s.state === "valid") };
}

export interface FilingGate {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  href: string;
}

export function filingGates(args: {
  packet: Packet;
  ledger: Ledger;
  statuses: SignoffStatus[];
  approvals: AdjustmentApproval[];
  steps: StepStatus[];
  client: ApprovalStatus;
  levels: string[];
}): FilingGate[] {
  const { ledger, statuses, approvals, steps, client, levels } = args;
  const blocking = ledger.all.filter((f) => f.kind === "note" && !f.retracted && !f.resolved && f.body.blocking === true);
  const returnStatuses = statuses.filter((s) => s.scope.id === "return");
  const topLevel = levels[levels.length - 1];
  const pendingApprovals = approvals.filter((a) => a.state === "pending" || a.state === "reopened");
  const openSteps = steps.filter((s) => s.auto !== "later" && !s.done);
  return [
    {
      id: "blocking-notes",
      label: "No open blocking review notes",
      ok: blocking.length === 0,
      detail: blocking.length ? blocking.length + " blocking note" + (blocking.length === 1 ? "" : "s") + " open: " + blocking.map((b) => b.target).join(", ") : "None open.",
      href: "/review#blocking",
    },
    {
      id: "signoffs",
      label: "Whole return signed at every level (" + levels.join(", ") + ")",
      ok: returnStatuses.length === levels.length && returnStatuses.every((s) => s.state === "valid"),
      detail: returnStatuses.map((s) => s.level + ": " + s.state).join(" · "),
      href: "/review",
    },
    {
      id: "partner-approvals",
      label: "Every adjustment over the threshold approved by a partner",
      ok: pendingApprovals.length === 0,
      detail: pendingApprovals.length ? pendingApprovals.length + " awaiting partner approval" : approvals.filter((a) => a.state === "approved").length + " approved, none pending.",
      href: "/review#approvals",
    },
    {
      id: "steps",
      label: "Required steps complete",
      ok: openSteps.length === 0,
      detail: openSteps.length ? openSteps.length + " open: " + openSteps.map((s) => s.label).join("; ") : "All done.",
      href: "/completeness",
    },
    {
      id: "client",
      label: "Client approval and e-file authorization (both spouses)",
      ok: client.complete,
      detail: client.signers.map((s) => s.name + ": " + s.state).join(" · ") + (client.request ? "" : " · not yet sent"),
      href: "/approve",
    },
    {
      id: "top-signoff",
      label: topLevel + " sign-off is current after client approval",
      ok: returnStatuses.find((s) => s.level === topLevel)?.state === "valid" && client.complete,
      detail: "The client signs what the partner signed; any change after either reopens both.",
      href: "/review",
    },
  ];
}
