"use server";

import { revalidatePath } from "next/cache";
import { canEditStandards, canLogTime } from "@/lib/permissions";
import { getCurrentActor } from "@/lib/session";
import { parseStandardValue, STANDARD_DEFS, standardTarget } from "@/lib/standards";
import { getEffectivePacket } from "@/lib/standards-server";
import type { ActionResult } from "./actions";
import { getLedger, insertFact } from "./repo";
import { StandardBody, TimeBody } from "./types";

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

/** Change one firm standard. The starter value stays in the packet; this records what replaces it and why. */
export async function standardAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canEditStandards(actor)) return bad("Only the firm administrator or a partner changes firm standards.");
    const def = STANDARD_DEFS.find((d) => d.key === str(fd, "key"));
    if (!def) return bad("Unknown standard.");
    if (!def.editable) return bad(def.label + " is enforced structurally and cannot be edited here.");
    const value = parseStandardValue(def, str(fd, "value"));
    const reason = str(fd, "text").trim();
    if (!reason) return bad("Say why the standard is changing; the reason is part of the record.");
    const body = StandardBody.parse({ key: def.key, value, text: reason });
    const row = await insertFact({ kind: "standard", actorId: actor.id, target: standardTarget(def.key), body });
    return done(row.id);
  });
}

/** Go back to the packet's starter value by retracting the current override. */
export async function revertStandardAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canEditStandards(actor)) return bad("Only the firm administrator or a partner changes firm standards.");
    const key = str(fd, "key");
    const { ledger } = await getLedger();
    const current = ledger.latest(standardTarget(key), "standard");
    if (!current) return bad("Already at the starter value.");
    const row = await insertFact({ kind: "retract", actorId: actor.id, target: standardTarget(key), body: { factId: current.id, reason: str(fd, "text") || "Reverted to the starter standard" }, supersedes: current.id });
    return done(row.id);
  });
}

/** Log time against an area of the return. */
export async function timeAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canLogTime(actor)) return bad("Only firm staff log time.");
    const { packet } = await getEffectivePacket();
    const area = str(fd, "area");
    if (!(area in packet.firm.budget_hours)) return bad("Unknown area.");
    const hours = Number(str(fd, "hours"));
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return bad("Hours must be between 0 and 24.");
    const date = str(fd, "date") || new Date().toISOString().slice(0, 10);
    const body = TimeBody.parse({ hours: Math.round(hours * 4) / 4, date, text: str(fd, "text") || undefined });
    const row = await insertFact({ kind: "time", actorId: actor.id, target: "area:" + area, body });
    return done(row.id);
  });
}
