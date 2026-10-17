import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Fact } from "@/db/schema";
import { buildLedger } from "@/lib/facts/ledger";
import { buildIndex } from "@/lib/packet/index";
import { PacketSchema } from "@/lib/packet/schema";
import { actorsFromPacket } from "@/lib/roles";
import { agencyDecision, asOf, filingState, frozenReason, identityMismatches, latePaymentEstimate, seasonEvents, submissionId } from "./season";

const packet = PacketSchema.parse(JSON.parse(readFileSync(path.join(process.cwd(), "data", "packet.json"), "utf8")) as unknown);
const index = buildIndex(packet);
const actors = actorsFromPacket(packet);
const HASH = "a".repeat(64);

let seq = 0;
function fact(kind: string, target: string, body: Record<string, unknown>, at = "2026-10-01T12:00:00Z", actorId = "st-01"): Fact {
  seq += 1;
  return { id: "00000000-0000-4000-8000-" + String(seq).padStart(12, "0"), seq, clientId: "c", kind, actorId, at: new Date(at), target, body, batchId: null, supersedes: null } as Fact;
}
const transmit = (j: string, at: string, kind = "original") => fact("filing", "filing:" + j, { event: "transmit", kind, submissionId: "73150420262740000001", hash: HASH, version: "v3", adjustments: 0, summary: { total_tax: 1, payments: 1, balance_due: 0 }, lines: {} }, at);
const ack = (j: string, t: Fact, status: string, at: string) => fact("filing", "filing:" + j, { event: "ack", transmissionId: t.id, status, errors: [], agencyDate: at }, at);

describe("filing lifecycle", () => {
  it("starts in preparation, unfrozen", () => {
    const s = filingState(buildLedger([], actors));
    expect(s.phase).toBe("preparing");
    expect(s.frozen).toBe(false);
    expect(frozenReason(s)).toBeNull();
  });

  it("freezes on transmission, unfreezes on rejection, refreezes on acceptance", () => {
    const t1 = transmit("federal", "2026-10-02T10:00:00Z");
    const c1 = transmit("california", "2026-10-02T10:00:00Z");
    let s = filingState(buildLedger([t1, c1], actors));
    expect(s.phase).toBe("transmitted");
    expect(s.frozen).toBe(true);
    expect(frozenReason(s)).toMatch(/awaiting/);

    const r1 = ack("federal", t1, "rejected", "2026-10-02T12:00:00Z");
    s = filingState(buildLedger([t1, c1, r1], actors));
    expect(s.phase).toBe("rejected");
    expect(s.frozen).toBe(false);

    const t2 = transmit("federal", "2026-10-03T10:00:00Z");
    const a2 = ack("federal", t2, "accepted", "2026-10-03T11:00:00Z");
    s = filingState(buildLedger([t1, c1, r1, t2, a2], actors));
    expect(s.phase).toBe("filed");
    expect(s.frozen).toBe(true);
    expect(s.asFiled?.fact.id).toBe(t2.id);
    expect(frozenReason(s)).toMatch(/amendment/);
  });

  it("an amendment unfreezes; an accepted amended transmission closes it", () => {
    const t = transmit("federal", "2026-10-03T10:00:00Z");
    const a = ack("federal", t, "accepted", "2026-10-03T11:00:00Z");
    const am = fact("filing", "filing:federal", { event: "amendment", amends: t.id, reason: "1099-K counted twice" }, "2026-10-05T10:00:00Z");
    let s = filingState(buildLedger([t, a, am], actors));
    expect(s.phase).toBe("amending");
    expect(s.frozen).toBe(false);
    expect(s.amendmentFromSeq).toBe(t.seq);

    const tx = transmit("federal", "2026-10-06T10:00:00Z", "amended");
    s = filingState(buildLedger([t, a, am, tx], actors));
    expect(s.frozen).toBe(true);
    const ax = ack("federal", tx, "accepted", "2026-10-06T12:00:00Z");
    s = filingState(buildLedger([t, a, am, tx, ax], actors));
    expect(s.phase).toBe("amended");
    expect(s.amendment).toBeNull();
    expect(s.asFiled?.fact.id).toBe(tx.id);
  });
});

describe("the simulated agency", () => {
  it("finds the dependent SSN typo against the Social Security card", () => {
    const m = identityMismatches(packet, index, buildLedger([], actors));
    expect(m.map((x) => x.personId)).toEqual(["theo"]);
    expect(m[0].documentId).toBe("D71");
    expect(m[0].correction).toBeNull();
  });

  it("rejects the federal return with R0000-504-02 until the SSN is corrected, and holds California", () => {
    const t = transmit("federal", "2026-10-02T10:00:00Z");
    const c = transmit("california", "2026-10-02T10:00:00Z");
    let ledger = buildLedger([t, c], actors);
    let s = filingState(ledger);
    const fed = agencyDecision(packet, index, ledger, s.federal.current!, s);
    expect(fed.status).toBe("rejected");
    expect(fed.errors[0].code).toBe("R0000-504-02");
    expect(fed.errors[0].message).toContain("dependent 2: Theo");
    const ca = agencyDecision(packet, index, ledger, s.california.current!, s);
    expect(ca.status).toBe("held");

    const fix = fact("correction", "person:theo", { field: "ssn", evidence: "ev-1080" }, "2026-10-02T13:00:00Z");
    const t2 = transmit("federal", "2026-10-03T10:00:00Z");
    const c2 = transmit("california", "2026-10-03T10:00:00Z");
    ledger = buildLedger([t, c, fix, t2, c2], actors);
    s = filingState(ledger);
    expect(identityMismatches(packet, index, ledger)[0].correction?.id).toBe(fix.id);
    expect(agencyDecision(packet, index, ledger, s.federal.current!, s).status).toBe("accepted");
    const fedAck = ack("federal", t2, "accepted", "2026-10-03T11:00:00Z");
    ledger = buildLedger([t, c, fix, t2, c2, fedAck], actors);
    s = filingState(ledger);
    expect(agencyDecision(packet, index, ledger, s.california.current!, s).status).toBe("accepted");
  });

  it("formats a 20-digit submission id", () => {
    const id = submissionId("731504", new Date("2026-07-13T17:04:00Z"), 12345);
    expect(id).toHaveLength(20);
    expect(id.startsWith("7315042026194")).toBe(true);
  });
});

describe("timeline replay", () => {
  it("merges the packet timeline, documents, messages, deadlines and ledger facts in time order", () => {
    const f = fact("verification", "F1040.1a", { type: "traced_to_source" }, "2026-10-01T12:00:00Z");
    const events = seasonEvents(packet, buildLedger([f], actors));
    for (let i = 1; i < events.length; i++) expect(events[i - 1].at <= events[i].at).toBe(true);
    expect(events.some((e) => e.id === "tl-21" || e.id === "tl:tl-21")).toBe(true);
    expect(events.filter((e) => e.kind === "document").length + packet.timeline.filter((t) => t.event === "document_received").length).toBeGreaterThanOrEqual(packet.documents.length);
    expect(events.find((e) => e.id === "fact:" + f.id)?.kind).toBe("fact");
  });

  it("reports the file as it stood at a moment", () => {
    const ledger = buildLedger([], actors);
    const events = seasonEvents(packet, ledger);
    const march = asOf(packet, ledger, events, "2026-03-10T00:00:00Z");
    expect(march.version).toBe("v1");
    expect(march.documentsReceived).toBeLessThan(packet.documents.length);
    expect(march.milestones.extension).toBe(false);
    const july = asOf(packet, ledger, events, "2026-07-16T00:00:00Z");
    expect(july.version).toBe("v3");
    expect(july.milestones.rejected).toBe(true);
    expect(july.milestones.accepted).toBe(true);
    expect(july.milestones.notice).toBe(false);
    const later = asOf(packet, ledger, events, "2028-02-01T00:00:00Z");
    expect(later.milestones.notice).toBe(true);
    expect(later.documentsReceived).toBe(packet.documents.length);
  });
});

describe("post-filing arithmetic", () => {
  it("charges interest by the day and the failure-to-pay penalty by the month or part", () => {
    const e = latePaymentEstimate(4220, "2026-04-15", "2026-07-20", { interestAnnual: 0.07, penaltyPerMonth: 0.005 });
    expect(e.days).toBe(96);
    expect(e.months).toBe(4);
    expect(e.interest).toBeCloseTo(4220 * 0.07 * (96 / 365), 1);
    expect(e.penalty).toBeCloseTo(4220 * 0.005 * 4, 2);
    expect(latePaymentEstimate(0, "2026-04-15", "2026-07-20", { interestAnnual: 0.07, penaltyPerMonth: 0.005 }).total).toBe(0);
    expect(latePaymentEstimate(1000, "2026-04-15", "2026-04-15", { interestAnnual: 0.07, penaltyPerMonth: 0.005 }).total).toBe(0);
  });
});
