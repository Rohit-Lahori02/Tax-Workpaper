"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPacket } from "@/lib/packet/load";
import { canNote, canVerify } from "@/lib/permissions";
import { getCurrentActor } from "@/lib/session";
import type { ActionResult } from "./actions";
import { frozenMessage } from "./guards";
import { insertFact } from "./repo";
import { DispositionBody, JudgmentBody, StepBody } from "./types";

const Target = z.string().trim().min(1).max(200);

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

/** A judgment call, election, variance explanation, due-diligence record, penalty or outside-filing decision. */
export async function judgmentAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canVerify(actor)) return bad("Your role cannot record judgments.");
    const frozen = await frozenMessage();
    if (frozen) return bad(frozen);
    const target = Target.parse(str(fd, "target"));
    const answers = fd
      .getAll("answers")
      .map((a) => String(a))
      .filter((a) => /^\d+$/.test(a))
      .map(Number);
    const answerCount = Number(str(fd, "answerCount") || "0");
    const body = JudgmentBody.parse({
      type: str(fd, "type"),
      text: str(fd, "text"),
      authority: str(fd, "authority") || undefined,
      choice: str(fd, "choice") || undefined,
      status: str(fd, "status") || undefined,
      answers: answerCount > 0 ? Array.from({ length: answerCount }, (_, i) => answers.includes(i)) : undefined,
    });
    const { packet } = getPacket();
    const rule = packet.firm.starter_standards.rules.find((r) => /judgment call records the authority/i.test(r));
    if (rule && (body.type === "judgment_call" || body.type === "election") && !body.authority) {
      return bad("Firm standard: every judgment call records the authority relied on.");
    }
    if (body.type === "due_diligence" && body.answers && body.answers.some((a) => !a)) {
      return bad("Every due-diligence item must be confirmed before it is recorded as complete.");
    }
    const row = await insertFact({ kind: "judgment", actorId: actor.id, target, body });
    return done(row.id);
  });
}

/** Why a document that reaches no line is nevertheless accounted for. */
export async function dispositionAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canNote(actor)) return bad("Your role cannot disposition documents.");
    const { index } = getPacket();
    const target = Target.parse(str(fd, "target"));
    if (!index.documents.has(target)) return bad("Unknown document.");
    const body = DispositionBody.parse({ disposition: str(fd, "disposition"), text: str(fd, "text") || undefined });
    const row = await insertFact({ kind: "disposition", actorId: actor.id, target, body });
    return done(row.id);
  });
}

/** Mark one of the firm's required steps complete, or reopen it. */
export async function stepAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canVerify(actor)) return bad("Your role cannot complete required steps.");
    const target = Target.parse(str(fd, "target"));
    if (!/^step:\d+$/.test(target)) return bad("Unknown step.");
    const body = StepBody.parse({ done: str(fd, "done") === "true", text: str(fd, "text") || undefined });
    const row = await insertFact({ kind: "step", actorId: actor.id, target, body });
    return done(row.id);
  });
}
