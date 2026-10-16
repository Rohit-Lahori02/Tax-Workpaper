import type { Fact } from "@/db/schema";
import type { Actor } from "@/lib/roles";
import { EMPTY_SUMMARY, type FactView, type TargetSummary } from "./types";

/**
 * The ledger as a readable structure. Pure: takes rows in arrival order and
 * actors, returns views with retractions, resolutions and answers applied.
 * Nothing here touches a database.
 */
export interface Ledger {
  /** Every fact in arrival order, control facts included. */
  all: FactView[];
  byId: Map<string, FactView>;
  byTarget: Map<string, FactView[]>;
  /** Questions with their answers attached, arrival order. */
  questions: FactView[];
  summary(target: string): TargetSummary;
  /** Facts for a target, newest first, control facts folded into their parents. */
  forTarget(target: string): FactView[];
}

const CONTROL_KINDS = new Set(["retract", "resolve", "answer", "seen"]);

export function buildLedger(rows: Fact[], actors: Actor[]): Ledger {
  const actorById = new Map(actors.map((a) => [a.id, a]));
  const all: FactView[] = [];
  const byId = new Map<string, FactView>();
  const byTarget = new Map<string, FactView[]>();

  for (const row of rows) {
    const actor = actorById.get(row.actorId);
    const view: FactView = {
      id: row.id,
      seq: row.seq,
      kind: row.kind,
      actorId: row.actorId,
      actorName: actor?.name ?? row.actorId,
      actorRole: actor?.role ?? "unknown",
      at: row.at.toISOString(),
      target: row.target,
      body: row.body,
      batchId: row.batchId,
      supersedes: row.supersedes,
      retracted: false,
      resolved: false,
      answers: [],
    };
    all.push(view);
    byId.set(view.id, view);
    const list = byTarget.get(view.target);
    if (list) list.push(view);
    else byTarget.set(view.target, [view]);

    const ref = typeof row.body.factId === "string" ? byId.get(row.body.factId) : undefined;
    const q = typeof row.body.questionId === "string" ? byId.get(row.body.questionId) : undefined;
    if (row.kind === "retract" && ref) ref.retracted = true;
    if (row.kind === "resolve" && ref) ref.resolved = true;
    if (row.kind === "answer" && q) q.answers.push(view);
  }

  const summaries = new Map<string, TargetSummary>();
  const summary = (target: string): TargetSummary => {
    const cached = summaries.get(target);
    if (cached) return cached;
    const list = byTarget.get(target) ?? [];
    const s: TargetSummary = { ...EMPTY_SUMMARY, verifications: [] };
    for (const f of list) {
      if (f.retracted || CONTROL_KINDS.has(f.kind) || f.kind === "sensitive_view") continue;
      s.total += 1;
      if (f.kind === "verification" && typeof f.body.type === "string") s.verifications.push(f.body.type);
      if (f.kind === "note" && !f.resolved) {
        s.openNotes += 1;
        if (f.body.blocking === true) s.blockingOpen += 1;
      }
      if (f.kind === "question" && f.answers.filter((a) => !a.retracted).length === 0) s.openQuestions += 1;
      if (f.kind === "attachment") s.attachments += 1;
      if (f.kind === "adjustment") s.adjustments += 1;
    }
    summaries.set(target, s);
    return s;
  };

  const forTarget = (target: string): FactView[] =>
    (byTarget.get(target) ?? []).filter((f) => !CONTROL_KINDS.has(f.kind) && f.kind !== "sensitive_view").slice().reverse();

  return {
    all,
    byId,
    byTarget,
    questions: all.filter((f) => f.kind === "question"),
    summary,
    forTarget,
  };
}
