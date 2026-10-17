import "server-only";
import { cache } from "react";
import { runChecks, type CheckRun } from "@/lib/checks/run";
import { decisionPoints, documentAccounting, dueDiligenceItems, requiredSteps, varianceItems, type StepStatus } from "@/lib/completeness";
import { effectiveReturn, type EffectiveReturn } from "@/lib/effective";
import type { Ledger } from "@/lib/facts/ledger";
import { getLedger } from "@/lib/facts/repo";
import type { PacketIndex } from "@/lib/packet/index";
import { getPacket } from "@/lib/packet/load";
import type { Packet } from "@/lib/packet/schema";
import type { Actor } from "@/lib/roles";
import { filingState, identityMismatches, type FilingState, type IdentityMismatch } from "@/lib/season";
import {
  adjustmentApprovals,
  approvalStatus,
  assignments,
  canSignOff,
  filingGates,
  scopes,
  scopeSnapshot,
  signoffStatus,
  type AdjustmentApproval,
  type ApprovalStatus,
  type Assignment,
  type FilingGate,
  type Scope,
  type ScopeSnapshot,
  type SignoffStatus,
} from "@/lib/signoff";

export interface ReviewContext {
  packet: Packet;
  index: PacketIndex;
  ledger: Ledger;
  checks: CheckRun;
  eff: EffectiveReturn;
  levels: string[];
  scopes: Scope[];
  snapshots: Map<string, ScopeSnapshot>;
  statuses: SignoffStatus[];
  approvals: AdjustmentApproval[];
  steps: StepStatus[];
  returnHash: string;
  client: ApprovalStatus;
  gates: FilingGate[];
  assignments: Assignment[];
  filing: FilingState;
  identity: IdentityMismatch[];
}

/** Everything the review pages and actions need, computed once per request. */
export const getReviewContext = cache(async (): Promise<ReviewContext> => {
  const { packet, index } = getPacket();
  const { ledger } = await getLedger();
  const checks = runChecks(packet, index);
  const eff = effectiveReturn(packet, index, ledger);
  const levels = packet.firm.starter_standards.review_levels;
  const all = scopes(packet, index, checks);
  const snapshots = new Map(all.map((s) => [s.id, scopeSnapshot(s, ledger, eff)] as const));
  const statuses = all.flatMap((s) => levels.map((level) => signoffStatus(s, level, ledger, snapshots.get(s.id)!)));
  const approvals = adjustmentApprovals(ledger);
  const steps = requiredSteps(packet, index, ledger, {
    variances: varianceItems(packet, index, ledger, eff),
    dueDiligence: dueDiligenceItems(packet, index, ledger),
    decisions: decisionPoints(packet, index, ledger),
    documents: documentAccounting(index, ledger),
    checks,
  });
  const returnHash = snapshots.get("return")!.hash;
  const client = approvalStatus(packet, ledger, returnHash);
  const gates = filingGates({ packet, ledger, statuses, approvals, steps, client, levels });
  return {
    packet,
    index,
    ledger,
    checks,
    eff,
    levels,
    scopes: all,
    snapshots,
    statuses,
    approvals,
    steps,
    returnHash,
    client,
    gates,
    assignments: assignments(packet, ledger, all.map((s) => s.id)),
    filing: filingState(ledger),
    identity: identityMismatches(packet, index, ledger),
  };
});

export interface NeedsYouItem {
  kind: "question" | "signoff" | "reopened" | "blocking" | "approval" | "client-approval" | "deadline" | "filing" | "notice";
  title: string;
  detail: string;
  href: string;
  due?: string;
  overdue?: boolean;
}

const DAY = 86400000;

/** What waits on one person right now, derived from the ledger and the firm's rules. */
export function needsYou(ctx: ReviewContext, actor: Actor, now = new Date()): NeedsYouItem[] {
  const out: NeedsYouItem[] = [];
  const { ledger, statuses, levels } = ctx;
  for (const q of ledger.questions) {
    if (q.retracted || q.answers.some((a) => !a.retracted)) continue;
    const to = String(q.body.to ?? "");
    if ((actor.kind === "client" && to === "client") || to === actor.id) {
      out.push({ kind: "question", title: "Answer a question on " + q.target, detail: String(q.body.text ?? ""), href: "/questions" });
    }
  }
  if (actor.kind === "staff") {
    const myLevel = actor.role === "quality_reviewer" ? "reviewer" : actor.role;
    const myScopes = new Set(ctx.assignments.filter((a) => a.assigneeId === actor.id).map((a) => a.scope));
    for (const scope of ctx.scopes) {
      const forScope = statuses.filter((s) => s.scope.id === scope.id);
      const mine = forScope.find((s) => s.level === myLevel);
      if (!mine) continue;
      if (mine.state === "reopened" && mine.fact?.actorId === actor.id) {
        out.push({ kind: "reopened", title: "Your " + myLevel + " sign-off on " + scope.label + " reopened", detail: mine.changes.facts + " new record(s); " + mine.changes.lines.length + " line(s) changed since you signed.", href: "/review" });
      } else if (mine.state !== "valid" && (myScopes.has(scope.id) || myLevel === "partner")) {
        const el = canSignOff(actor, scope, myLevel, levels, forScope, ledger);
        if (el.allowed) out.push({ kind: "signoff", title: "Sign off " + scope.label + " as " + myLevel, detail: "Everything below your level is current.", href: "/review" });
      }
    }
    if (actor.role === "partner") {
      const pending = ctx.approvals.filter((a) => a.state === "pending" || a.state === "reopened");
      for (const p of pending) out.push({ kind: "approval", title: "Approve adjustment on " + p.adjustment.key, detail: p.adjustment.reason, href: "/review#approvals" });
    }
    const blocking = ledger.all.filter((f) => f.kind === "note" && !f.retracted && !f.resolved && f.body.blocking === true);
    for (const b of blocking) {
      const scope = ctx.scopes.find((s) => s.lines.includes(b.target) || s.documents.includes(b.target));
      if (actor.role === "preparer" && scope && !myScopes.has(scope.id)) continue;
      out.push({ kind: "blocking", title: "Blocking note on " + b.target, detail: String(b.body.text ?? ""), href: "/review#blocking" });
    }
    const fs = ctx.filing;
    const rejected = [fs.federal.current, fs.california.current].filter((t) => t && t.status === "rejected");
    if (rejected.length && (actor.role === "preparer" || actor.role === "reviewer")) {
      out.push({ kind: "filing", title: "E-file rejected: fix and retransmit", detail: rejected.flatMap((t) => t!.errors.map((e) => e.code + " " + e.message)).join(" "), href: "/filing" });
    }
    if ([fs.federal.current, fs.california.current].some((t) => t && t.status === "transmitted")) {
      out.push({ kind: "filing", title: "Pick up the agency acknowledgment", detail: "The return was transmitted and the agencies have not answered yet.", href: "/filing" });
    }
    const uncorrected = ctx.identity.filter((m) => !m.correction);
    if (uncorrected.length && actor.role !== "firm_administrator") {
      out.push({ kind: "filing", title: "Identity data disagrees with a document in the file", detail: uncorrected.map((m) => m.name + ": " + m.field.toUpperCase() + " on " + m.documentId + " differs from the entry").join("; "), href: "/filing#identity" });
    }
    for (const n of ctx.packet.tax_agency_records.notices) {
      if (!n.response_due || !n.document) continue;
      const doc = ctx.packet.documents.find((d) => d.id === n.document);
      if (!doc || doc.received_at > now.toISOString()) continue;
      const responded = ledger.latest("notice:" + n.id, "filing");
      if (responded) continue;
      const days = Math.ceil((Date.parse(n.response_due) - now.getTime()) / DAY);
      out.push({ kind: "notice", title: n.agency + " " + n.type + " response " + (days < 0 ? "overdue" : "due in " + days + " day" + (days === 1 ? "" : "s")), detail: (n.items_under_examination ?? []).join(" "), href: "/notices/" + n.id, due: n.response_due, overdue: days < 0 });
    }
    for (const a of ctx.assignments) {
      if (a.assigneeId !== actor.id || !a.due) continue;
      const days = Math.ceil((Date.parse(a.due) - now.getTime()) / DAY);
      if (days <= 14) out.push({ kind: "deadline", title: (a.role + " work on " + (ctx.scopes.find((s) => s.id === a.scope)?.label ?? a.scope)) + (days < 0 ? " is overdue" : " is due in " + days + " day" + (days === 1 ? "" : "s")), detail: a.due, href: "/work", due: a.due, overdue: days < 0 });
    }
  } else if (ctx.client.requestCurrent) {
    const me = ctx.client.signers.find((s) => s.actorId === actor.id);
    if (me && me.state !== "valid") out.push({ kind: "client-approval", title: "Review and sign your return", detail: "Your preparer has sent the return for your approval and e-file signature.", href: "/approve" });
  }
  return out;
}
