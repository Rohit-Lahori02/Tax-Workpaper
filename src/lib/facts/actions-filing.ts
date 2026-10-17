"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { noticePackage } from "@/lib/notice";
import { canAmend, canCorrectIdentity, canFile, canRespondToNotice, canRollForward } from "@/lib/permissions";
import { getReviewContext } from "@/lib/review";
import { agencyDecision, basisGaps, carryforwardRows, FILED_LINE_KEYS, filingState, filingTarget, identityMismatches, JURISDICTIONS, submissionId, type Jurisdiction } from "@/lib/season";
import { getCurrentActor, getNow, NOW_COOKIE } from "@/lib/session";
import { sha256 } from "@/lib/signoff";
import type { ActionResult } from "./actions";
import { insertFact } from "./repo";
import { CorrectionBody, FilingBody } from "./types";

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
function jurisdiction(raw: string): Jurisdiction | null {
  return raw === "federal" || raw === "california" ? raw : null;
}

/** Record an extension of time to file, with the payment made alongside it. Filing later is allowed; paying later is not. */
export async function extensionAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canFile(actor)) return bad("Your role cannot file an extension.");
    const ctx = await getReviewContext();
    const j = jurisdiction(str(fd, "jurisdiction"));
    if (!j) return bad("Unknown jurisdiction.");
    const state = filingState(ctx.ledger);
    if (state[j].current) return bad("The " + j + " return has already been transmitted; an extension no longer applies.");
    const payment = Number(str(fd, "payment").replace(/[,$\s]/g, ""));
    if (!Number.isFinite(payment) || payment < 0) return bad("Enter the payment as a number.");
    const ref = (ctx.packet.what_if.extension as Record<string, unknown>)[j] as Record<string, number> | undefined;
    const ws = ctx.eff.workingSummary[j];
    const body = FilingBody.parse({
      event: "extension",
      form: j === "federal" ? "Form 4868" : "FTB 3519",
      payment,
      basedOn: String((ctx.packet.what_if.extension as Record<string, unknown>).based_on_version ?? ctx.eff.version),
      estimatedTax: ref?.estimated_total_tax ?? ws.total_tax,
      estimatedPayments: ref?.payments ?? ws.payments,
      estimatedBalance: ref?.estimated_balance ?? ws.balance_due,
      text: str(fd, "text") || undefined,
    });
    const row = await insertFact({ kind: "filing", actorId: actor.id, target: filingTarget(j), body });
    return done(row.id);
  });
}

/** Transmit the return (or an amended return) to both agencies. Every filing gate must be open; the return freezes until acknowledged. */
export async function transmitAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canFile(actor)) return bad("Your role cannot transmit returns.");
    const ctx = await getReviewContext();
    const state = filingState(ctx.ledger);
    const amended = str(fd, "kind") === "amended";
    if (state.frozen) return bad("A transmission is already in flight or accepted. Wait for the acknowledgment, or open an amendment.");
    if (amended && !state.amendment) return bad("Open an amendment first.");
    if (!amended && state.asFiled) return bad("The original return is already filed. Changes go on an amended return.");
    const closed = ctx.gates.filter((g) => !g.ok);
    if (closed.length) return bad("Filing gates still closed: " + closed.map((g) => g.label).join("; "));
    if (amended) {
      const since = ctx.eff.adjustments.filter((a) => a.seq > (state.amendmentFromSeq ?? 0));
      if (!since.length) return bad("Nothing has changed since the return of record; there is nothing to amend.");
    }
    const efin = String((ctx.packet.firm.firm_identity as Record<string, unknown>).efin ?? "000000");
    const at = new Date();
    const batchId = randomUUID();
    const lines: Record<string, number | string> = {};
    for (const k of FILED_LINE_KEYS) {
      const v = ctx.eff.value(k);
      if (v !== undefined) lines[k] = v;
    }
    const seqBase = ctx.ledger.all.length + 1;
    let firstId: string | undefined;
    for (const [i, j] of JURISDICTIONS.entries()) {
      const body = FilingBody.parse({
        event: "transmit",
        kind: amended ? "amended" : "original",
        submissionId: submissionId(efin, at, seqBase * 10 + i),
        hash: ctx.returnHash,
        version: ctx.eff.version,
        adjustments: ctx.eff.adjustments.length,
        summary: ctx.eff.workingSummary[j],
        lines,
        amends: amended && state.asFiled ? state.asFiled.fact.id : undefined,
        text: str(fd, "text") || undefined,
      });
      const row = await insertFact({ kind: "filing", actorId: actor.id, target: filingTarget(j), body, batchId });
      firstId ??= row.id;
    }
    return done(firstId);
  });
}

/** Pick up the agencies' acknowledgments for everything transmitted and not yet acknowledged. */
export async function acknowledgeAction(): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (actor.kind !== "staff") return bad("Only firm staff pick up acknowledgments.");
    const ctx = await getReviewContext();
    const { packet, index, ledger } = ctx;
    let state = filingState(ledger);
    const now = (await getNow()).iso;
    const pending = [...state.federal.transmissions, ...state.california.transmissions].filter((t) => t.status === "transmitted" || t.status === "held");
    if (!pending.length) return bad("Nothing is waiting for an acknowledgment.");
    const batchId = randomUUID();
    let count = 0;
    // Federal first: the state decision depends on it.
    for (const j of JURISDICTIONS) {
      for (const t of pending.filter((p) => p.jurisdiction === j)) {
        const decision = agencyDecision(packet, index, ledger, t, state);
        if (t.status === "held" && decision.status === "held") continue;
        const body = FilingBody.parse({ event: "ack", transmissionId: t.fact.id, status: decision.status, errors: decision.errors, agencyDate: now });
        await insertFact({ kind: "filing", actorId: actor.id, target: filingTarget(j), body, batchId });
        count += 1;
        // Reflect the federal decision for the California pass without a second database read.
        if (j === "federal") {
          t.status = decision.status;
          state = { ...state, federal: { ...state.federal, transmissions: state.federal.transmissions.map((x) => (x.fact.id === t.fact.id ? { ...x, status: decision.status } : x)) } };
        }
      }
    }
    if (!count) return bad("The agencies have nothing new to say yet.");
    return done(batchId);
  });
}

/** Correct a hand-entered identity field from a document in the file. The value is never stored; the record points at the evidence. */
export async function correctionAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canCorrectIdentity(actor)) return bad("Your role cannot correct identity data.");
    const ctx = await getReviewContext();
    const personId = str(fd, "person");
    const body = CorrectionBody.parse({ field: str(fd, "field"), evidence: str(fd, "evidence"), text: str(fd, "text") || undefined });
    const m = identityMismatches(ctx.packet, ctx.index, ctx.ledger).find((x) => x.personId === personId && x.field === body.field && x.evidence === body.evidence);
    if (!m) return bad("No identity document in the file disagrees with that entry.");
    if (m.correction) return bad("Already corrected.");
    const row = await insertFact({ kind: "correction", actorId: actor.id, target: "person:" + personId, body });
    return done(row.id);
  });
}

/** Open an amendment on top of the accepted return. Numbers unfreeze; the differences become Form 1040-X. */
export async function openAmendmentAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canAmend(actor)) return bad("Only a reviewer or partner opens an amendment.");
    const ctx = await getReviewContext();
    const state = filingState(ctx.ledger);
    if (!state.asFiled) return bad("There is no accepted return to amend.");
    if (state.amendment) return bad("An amendment is already open.");
    if (state.federal.current && state.federal.current.status === "transmitted") return bad("Wait for the acknowledgment first.");
    const body = FilingBody.parse({ event: "amendment", amends: state.asFiled.fact.id, reason: str(fd, "reason") });
    const row = await insertFact({ kind: "filing", actorId: actor.id, target: filingTarget("federal"), body });
    return done(row.id);
  });
}

/** Record that the response package for a notice went out, with the fingerprint of what it contained. */
export async function noticeResponseAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canRespondToNotice(actor)) return bad("Your role cannot send a notice response.");
    const ctx = await getReviewContext();
    const notice = ctx.packet.tax_agency_records.notices.find((n) => n.id === str(fd, "noticeId"));
    if (!notice) return bad("Unknown notice.");
    const pkg = noticePackage(ctx.packet, ctx.index, ctx.ledger, ctx.eff, notice, (await getNow()).iso, sha256);
    const body = FilingBody.parse({ event: "notice_response", noticeId: notice.id, hash: pkg.hash, items: pkg.items.length, exhibits: pkg.exhibits.map((e) => e.documentId), text: str(fd, "text") || undefined });
    const row = await insertFact({ kind: "filing", actorId: actor.id, target: "notice:" + notice.id, body });
    return done(row.id);
  });
}

/** Roll the file forward: carryovers and open basis items become next year's opening record. */
export async function rollforwardAction(fd: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await getCurrentActor();
    if (!canRollForward(actor)) return bad("Your role cannot roll the file forward.");
    const ctx = await getReviewContext();
    const state = filingState(ctx.ledger);
    if (!state.asFiled) return bad("Roll forward after the return is accepted; carryovers are not final until then.");
    const rows = carryforwardRows(ctx.packet, ctx.index);
    const carryovers = Object.fromEntries(rows.map((r) => [r.id, r.value]));
    const openItems = basisGaps(ctx.packet, ctx.ledger).map((g) => g.label);
    const toYear = ctx.packet.household.tax_year + 1;
    const body = FilingBody.parse({ event: "rollforward", toYear, hash: sha256(JSON.stringify(carryovers)), carryovers, openItems, text: str(fd, "text") || undefined });
    const row = await insertFact({ kind: "filing", actorId: actor.id, target: "year:" + toYear, body });
    return done(row.id);
  });
}

/** Set or clear the replay cursor. Viewing only: nothing is written to the ledger. */
export async function setNowAction(iso: string | null): Promise<ActionResult> {
  const jar = await cookies();
  if (iso === null) jar.delete(NOW_COOKIE);
  else {
    const parsed = z.string().datetime().safeParse(iso);
    if (!parsed.success) return bad("Not a moment in time.");
    jar.set(NOW_COOKIE, parsed.data, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
