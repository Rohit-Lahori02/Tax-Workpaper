"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { activeAdjustments } from "@/lib/effective";
import { canApproveAdjustment, canAssign, canClientApprove, canRequestApproval } from "@/lib/permissions";
import { getReviewContext } from "@/lib/review";
import { getCurrentActor } from "@/lib/session";
import { adjustmentHash, canSignOff, scopeById } from "@/lib/signoff";
import type { ActionResult } from "./actions";
import { insertFact } from "./repo";
import { ApprovalBody, ApprovalRequestBody, AssignmentBody, SignoffBody } from "./types";

function bad(error: string): ActionResult {
  return { ok: false, error };
}
function done(id?: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, id };
}
function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}
async function guarded(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    return bad(e instanceof Error ? e.message : "Something went wrong");
  }
}

/** Sign a scope at a level. Stores the hash of everything in the scope right now. */
export async function signoffAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    const ctx = await getReviewContext();
    const scope = scopeById(ctx.scopes, str(fd, "scope"));
    const level = str(fd, "level");
    if (!scope || !ctx.levels.includes(level)) return bad("Unknown scope or level.");
    const statuses = ctx.statuses.filter((s) => s.scope.id === scope.id);
    const el = canSignOff(actor, scope, level, ctx.levels, statuses, ctx.ledger, ctx.assignments.find((a) => a.scope === scope.id && a.role === "preparer")?.assigneeId ?? null);
    if (!el.allowed) return bad(el.reason ?? "Not allowed.");
    const snap = ctx.snapshots.get(scope.id)!;
    const body = SignoffBody.parse({
      level,
      scope: scope.id,
      hash: snap.hash,
      snapshot: { facts: snap.facts, lines: snap.lines, adjustments: snap.adjustments },
      text: str(fd, "text") || undefined,
    });
    const row = await insertFact({ kind: "signoff", actorId: actor.id, target: scope.id, body });
    return done(row.id);
  });
}

/** Partner approval of one adjustment over the firm threshold. */
export async function approveAdjustmentAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canApproveAdjustment(actor)) return bad("Only a partner approves adjustments over the threshold.");
    const ctx = await getReviewContext();
    const factId = z.string().uuid().parse(str(fd, "factId"));
    const a = activeAdjustments(ctx.ledger).find((x) => x.factId === factId);
    if (!a) return bad("That adjustment is no longer active.");
    if (a.actorId === actor.id) return bad("Firm standard: a person may not sign off on work they prepared.");
    const body = SignoffBody.parse({
      level: "partner",
      scope: "fact:" + factId,
      hash: adjustmentHash(a),
      snapshot: { facts: 1, lines: { [a.key]: a.newValue }, adjustments: 1 },
      text: str(fd, "text") || undefined,
    });
    const row = await insertFact({ kind: "signoff", actorId: actor.id, target: "fact:" + factId, body });
    return done(row.id);
  });
}

export async function assignAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canAssign(actor)) return bad("Only a partner or the firm administrator assigns work.");
    const ctx = await getReviewContext();
    const scope = str(fd, "scope");
    if (!ctx.scopes.some((s) => s.id === scope)) return bad("Unknown scope.");
    const body = AssignmentBody.parse({ role: str(fd, "role"), assigneeId: str(fd, "assigneeId"), due: str(fd, "due") || undefined, text: str(fd, "text") || undefined });
    if (!["preparer", "reviewer", "partner"].includes(body.role)) return bad("Unknown role.");
    const staff = ctx.packet.firm.staff.find((s) => s.id === body.assigneeId);
    if (!staff) return bad("Assignee must be a member of staff.");
    if (body.role === "partner" && staff.role !== "partner") return bad("Partner work must be assigned to a partner.");
    const row = await insertFact({ kind: "assignment", actorId: actor.id, target: scope, body });
    return done(row.id);
  });
}

/** Send the return to the client for approval; records the hash they will be approving. */
export async function requestApprovalAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canRequestApproval(actor)) return bad("Your role cannot send the return for approval.");
    const ctx = await getReviewContext();
    const top = ctx.levels[ctx.levels.length - 1];
    const topStatus = ctx.statuses.find((s) => s.scope.id === "return" && s.level === top);
    if (!topStatus || topStatus.state !== "valid") return bad("The whole return needs a current " + top + " sign-off before it goes to the client.");
    const blocking = ctx.gates.find((g) => g.id === "blocking-notes");
    if (blocking && !blocking.ok) return bad("Open blocking notes must be resolved first.");
    const body = ApprovalRequestBody.parse({ hash: ctx.returnHash, message: str(fd, "message") || undefined });
    const row = await insertFact({ kind: "approval_request", actorId: actor.id, target: "return", body });
    return done(row.id);
  });
}

/** The client approves the return and authorizes e-filing with a self-selected PIN (Form 8879). */
export async function clientApproveAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canClientApprove(actor)) return bad("Only the client signs the approval.");
    const ctx = await getReviewContext();
    if (!ctx.client.requestCurrent) return bad("There is no current request to approve. Your preparer must send the return first.");
    const pin = str(fd, "pin");
    if (!/^\d{5}$/.test(pin)) return bad("Choose a 5-digit PIN.");
    if (str(fd, "consent") !== "on") return bad("The authorization statement must be accepted.");
    const body = ApprovalBody.parse({
      hash: ctx.returnHash,
      signerName: str(fd, "signerName"),
      pinHint: pin.slice(-2),
      consent: true,
      federalBalance: ctx.eff.workingSummary.federal.balance_due,
      californiaBalance: ctx.eff.workingSummary.california.balance_due,
      version: ctx.eff.version,
      adjustments: ctx.eff.adjustments.length,
    });
    const row = await insertFact({ kind: "approval", actorId: actor.id, target: "return", body });
    return done(row.id);
  });
}
