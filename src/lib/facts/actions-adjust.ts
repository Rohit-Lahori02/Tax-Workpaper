"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { activeAdjustments, CATEGORIES, categoryFor, effectFor, requiresPartner, type EffectCategory } from "@/lib/effective";
import { getPacket } from "@/lib/packet/load";
import { canAdjust, canUndoBatch, canVerify } from "@/lib/permissions";
import { getCurrentActor } from "@/lib/session";
import type { ActionResult } from "./actions";
import { getLedger, insertFact } from "./repo";
import { AdjustmentBody, SeenBody, VerificationBody } from "./types";

const Target = z.string().trim().min(1).max(200);
const Uuid = z.string().uuid();
const MAX_BULK = 500;

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

/** Change a line's working value. The engine's number stays; the change is a fact with a reason and an estimated tax effect. */
export async function adjustAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canAdjust(actor)) return bad("Your role cannot adjust the return.");
    const { packet, index } = getPacket();
    const versionId = index.latestVersion;
    const version = index.versions.get(versionId)!;
    const target = Target.parse(str(fd, "target"));
    const line = index.lines.get(versionId)?.get(target);
    if (!line || typeof line.value !== "number") return bad("Only numeric lines of " + versionId + " can be adjusted.");
    const newValue = Number(str(fd, "newValue").replace(/[,$\s]/g, ""));
    if (!Number.isFinite(newValue)) return bad("Enter the corrected amount as a number.");
    if (newValue === line.value) return bad("That is already the engine's value.");
    const categoryRaw = str(fd, "category");
    const category = (CATEGORIES.includes(categoryRaw as EffectCategory) ? categoryRaw : categoryFor(target, line)) as EffectCategory;
    const delta = Math.round((newValue - line.value) * 100) / 100;
    const effect = effectFor(category, delta, version);
    const body = AdjustmentBody.parse({
      engineValue: line.value,
      newValue,
      delta,
      reason: str(fd, "reason"),
      authority: str(fd, "authority") || undefined,
      category,
      effect,
      requiresPartner: requiresPartner(effect, packet),
      basedOn: versionId,
      fromFinding: str(fd, "fromFinding") || undefined,
    });
    const row = await insertFact({ kind: "adjustment", actorId: actor.id, target, body });
    return done(row.id);
  });
}

/** Verify many lines at once. All facts share a batch id so one undo retracts them together. */
export async function bulkVerifyAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canVerify(actor)) return bad("Your role cannot record verifications.");
    const { packet } = getPacket();
    let keys: unknown;
    try {
      keys = JSON.parse(str(fd, "keys"));
    } catch {
      return bad("No lines selected.");
    }
    const targets = z.array(Target).min(1).max(MAX_BULK).parse(keys);
    const body = VerificationBody.parse({ type: str(fd, "type"), note: str(fd, "note") || undefined });
    if (!packet.firm.starter_standards.verification_types.includes(body.type)) return bad("Unknown verification type.");
    const batchId = randomUUID();
    for (const target of targets) {
      await insertFact({ kind: "verification", actorId: actor.id, target, body, batchId });
    }
    return done(batchId);
  });
}

/** Retract every live fact in a batch, as one new batch. */
export async function undoBatchAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    const batchId = Uuid.parse(str(fd, "batchId"));
    const { ledger } = await getLedger();
    const live = ledger.all.filter((f) => f.batchId === batchId && !f.retracted && !["retract", "resolve", "seen", "sensitive_view"].includes(f.kind));
    if (live.length === 0) return bad("Nothing left to undo in that batch.");
    if (!canUndoBatch(actor, live.map((f) => f.actorId))) return bad("Only the person who made these records, or a partner, can undo them.");
    const undoBatch = randomUUID();
    for (const f of live) {
      await insertFact({ kind: "retract", actorId: actor.id, target: f.target, body: { factId: f.id, reason: "Undo batch" }, batchId: undoBatch, supersedes: f.id });
    }
    return done(undoBatch);
  });
}

/** Turn one of the engine's what-if alternatives into a batch of adjustments. */
export async function adoptWhatIfAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canAdjust(actor)) return bad("Your role cannot adjust the return.");
    const { packet, index } = getPacket();
    const id = str(fd, "id");
    const alt = packet.what_if.alternatives.find((a) => a.id === id);
    if (!alt) return bad("Unknown what-if.");
    const versionId = index.latestVersion;
    const version = index.versions.get(versionId)!;
    const lines = index.lines.get(versionId)!;
    const { ledger } = await getLedger();
    if (activeAdjustments(ledger).some((a) => a.whatIf === id)) return bad("This what-if is already adopted.");
    const batchId = randomUUID();
    let count = 0;
    for (const c of alt.changed_lines) {
      const line = lines.get(c.key);
      if (!line || typeof line.value !== "number" || typeof c.new !== "number") continue;
      const delta = Math.round((c.new - line.value) * 100) / 100;
      if (delta === 0) continue;
      const category = categoryFor(c.key, line);
      const effect = effectFor(category, delta, version);
      const body = AdjustmentBody.parse({
        engineValue: line.value,
        newValue: c.new,
        delta,
        reason: 'What-if "' + alt.description + '"',
        category,
        effect,
        requiresPartner: requiresPartner(effect, packet),
        basedOn: versionId,
        whatIf: id,
      });
      await insertFact({ kind: "adjustment", actorId: actor.id, target: c.key, body, batchId });
      count += 1;
    }
    if (count === 0) return bad("This what-if changes no line that exists in " + versionId + ".");
    return done(batchId);
  });
}

/** Record that the actor has seen everything up to now. */
export async function markSeenAction(): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    const { ledger } = await getLedger();
    const seq = ledger.all.length ? ledger.all[ledger.all.length - 1].seq : 0;
    const row = await insertFact({ kind: "seen", actorId: actor.id, target: "/", body: SeenBody.parse({ seq }) });
    return done(row.id);
  });
}
