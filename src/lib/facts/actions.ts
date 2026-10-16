"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { getPacket } from "@/lib/packet/load";
import {
  canAnswer,
  canAsk,
  canAttach,
  canBlock,
  canNote,
  canResolve,
  canRetract,
  canReveal,
  canVerify,
} from "@/lib/permissions";
import { getCurrentActor, REVEAL_COOKIE } from "@/lib/session";
import { getLedger, insertBlob, insertFact } from "./repo";
import { AnswerBody, AttachmentBody, NoteBody, QuestionBody, ResolveBody, RetractBody, VerificationBody } from "./types";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const Target = z.string().trim().min(1).max(200);
const Uuid = z.string().uuid();

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

export async function verifyAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canVerify(actor)) return bad("Your role cannot record verifications.");
    const { packet } = getPacket();
    const target = Target.parse(str(fd, "target"));
    const body = VerificationBody.parse({ type: str(fd, "type"), note: str(fd, "note") || undefined });
    if (!packet.firm.starter_standards.verification_types.includes(body.type)) return bad("Unknown verification type.");
    const row = await insertFact({ kind: "verification", actorId: actor.id, target, body });
    return done(row.id);
  });
}

export async function noteAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canNote(actor)) return bad("Your role cannot leave notes.");
    const target = Target.parse(str(fd, "target"));
    const body = NoteBody.parse({ text: str(fd, "text"), blocking: str(fd, "blocking") === "on" });
    if (body.blocking && !canBlock(actor)) return bad("Only a reviewer or partner can raise a blocking note.");
    const row = await insertFact({ kind: "note", actorId: actor.id, target, body });
    return done(row.id);
  });
}

export async function askAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canAsk(actor)) return bad("Your role cannot ask questions here.");
    const { packet } = getPacket();
    const target = Target.parse(str(fd, "target"));
    const body = QuestionBody.parse({ text: str(fd, "text"), to: str(fd, "to") });
    if (body.to !== "client" && !packet.firm.staff.some((s) => s.id === body.to)) return bad("Unknown addressee.");
    const row = await insertFact({ kind: "question", actorId: actor.id, target, body });
    return done(row.id);
  });
}

export async function answerAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    const questionId = Uuid.parse(str(fd, "questionId"));
    const { ledger } = await getLedger();
    const q = ledger.byId.get(questionId);
    if (!q || q.kind !== "question" || q.retracted) return bad("That question no longer exists.");
    const to = String(q.body.to ?? "");
    if (!canAnswer(actor, to)) return bad("This question is addressed to someone else.");
    const body = AnswerBody.parse({ questionId, text: str(fd, "text"), onBehalf: actor.kind === "staff" && to === "client" });
    const row = await insertFact({ kind: "answer", actorId: actor.id, target: q.target, body });
    return done(row.id);
  });
}

export async function attachAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canAttach(actor)) return bad("Your role cannot attach files.");
    const target = Target.parse(str(fd, "target"));
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return bad("Choose a file to attach.");
    if (file.size > MAX_ATTACHMENT_BYTES) return bad("Attachments are limited to 5 MB.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const blob = await insertBlob({
      actorId: actor.id,
      name: file.name.slice(0, 200),
      mime: file.type || "application/octet-stream",
      size: file.size,
      dataBase64: bytes.toString("base64"),
    });
    const body = AttachmentBody.parse({
      blobId: blob.id,
      name: blob.name,
      mime: blob.mime,
      size: blob.size,
      note: str(fd, "note") || undefined,
    });
    const row = await insertFact({ kind: "attachment", actorId: actor.id, target, body });
    return done(row.id);
  });
}

export async function retractAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    const factId = Uuid.parse(str(fd, "factId"));
    const { ledger } = await getLedger();
    const f = ledger.byId.get(factId);
    if (!f || f.retracted) return bad("Nothing to retract.");
    if (["retract", "resolve", "sensitive_view"].includes(f.kind)) return bad("That record cannot be retracted.");
    if (!canRetract(actor, f.actorId)) return bad("Only the author or a partner can retract this.");
    const body = RetractBody.parse({ factId, reason: str(fd, "reason") || undefined });
    const row = await insertFact({ kind: "retract", actorId: actor.id, target: f.target, body, supersedes: factId });
    return done(row.id);
  });
}

export async function resolveAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    const factId = Uuid.parse(str(fd, "factId"));
    const { ledger } = await getLedger();
    const f = ledger.byId.get(factId);
    if (!f || f.kind !== "note" || f.retracted || f.resolved) return bad("That note is not open.");
    if (!canResolve(actor, f.actorId)) return bad("Only the author or a reviewer can resolve this note.");
    const body = ResolveBody.parse({ factId, text: str(fd, "text") || undefined });
    const row = await insertFact({ kind: "resolve", actorId: actor.id, target: f.target, body });
    return done(row.id);
  });
}

/** Cleared staff may unmask sensitive data for their session; every page that shows it is then logged. */
export async function setRevealAction(on: boolean): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canReveal(actor)) return bad("Your clearance does not allow unmasked data.");
    const jar = await cookies();
    if (on) jar.set(REVEAL_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
    else jar.delete(REVEAL_COOKIE);
    return done();
  });
}
