import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Fact } from "@/db/schema";
import { runChecks } from "@/lib/checks/run";
import { categoryFor, effectFor, effectiveReturn } from "@/lib/effective";
import { buildLedger } from "@/lib/facts/ledger";
import { buildIndex } from "@/lib/packet/index";
import { PacketSchema } from "@/lib/packet/schema";
import { actorsFromPacket } from "@/lib/roles";
import { canSignOff, scopeById, scopeSnapshot, scopes, signoffStatus } from "./signoff";

const raw: unknown = JSON.parse(readFileSync(path.join(process.cwd(), "data", "packet.json"), "utf8"));
const packet = PacketSchema.parse(raw);
const index = buildIndex(packet);
const actors = actorsFromPacket(packet);
const checks = runChecks(packet, index);
const all = scopes(packet, index, checks);
const levels = packet.firm.starter_standards.review_levels;

let seq = 0;
function fact(kind: string, actorId: string, target: string, body: Record<string, unknown>): Fact {
  seq += 1;
  return { id: crypto.randomUUID(), seq, clientId: "CL-20417", kind, actorId, at: new Date(2026, 6, seq), target, body, batchId: null, supersedes: null };
}
function adjustment(actorId: string, key: string, newValue: number): Fact {
  const line = index.lines.get("v3")!.get(key)!;
  const engineValue = line.value as number;
  const category = categoryFor(key, line);
  return fact("adjustment", actorId, key, { engineValue, newValue, delta: newValue - engineValue, reason: "t", category, effect: effectFor(category, newValue - engineValue, index.versions.get("v3")!), requiresPartner: false, basedOn: "v3" });
}

describe("sign-offs", () => {
  const investments = scopeById(all, "area:investments_and_digital_assets")!;

  it("hashes a scope deterministically and reopens on change", () => {
    const l1 = buildLedger([], actors);
    const snapA = scopeSnapshot(investments, l1, effectiveReturn(packet, index, l1));
    const snapB = scopeSnapshot(investments, l1, effectiveReturn(packet, index, l1));
    expect(snapA.hash).toBe(snapB.hash);

    const sign = fact("signoff", "st-01", investments.id, { level: "preparer", scope: investments.id, hash: snapA.hash, snapshot: { facts: snapA.facts, lines: snapA.lines, adjustments: snapA.adjustments } });
    const l2 = buildLedger([sign], actors);
    const s2 = signoffStatus(investments, "preparer", l2, scopeSnapshot(investments, l2, effectiveReturn(packet, index, l2)));
    expect(s2.state).toBe("valid");

    const l3 = buildLedger([sign, adjustment("st-02", "SchB.1.2", 0)], actors);
    const s3 = signoffStatus(investments, "preparer", l3, scopeSnapshot(investments, l3, effectiveReturn(packet, index, l3)));
    expect(s3.state).toBe("reopened");
    expect(s3.changes.lines).toContain("SchB.1.2");
    expect(s3.changes.facts).toBe(1);
  });

  it("ignores changes outside the scope", () => {
    const l1 = buildLedger([], actors);
    const snap = scopeSnapshot(investments, l1, effectiveReturn(packet, index, l1));
    const sign = fact("signoff", "st-01", investments.id, { level: "preparer", scope: investments.id, hash: snap.hash, snapshot: { facts: 0, lines: {}, adjustments: 0 } });
    const l2 = buildLedger([sign, fact("verification", "st-01", "SchC.1", { type: "recalculated" })], actors);
    expect(signoffStatus(investments, "preparer", l2, scopeSnapshot(investments, l2, effectiveReturn(packet, index, l2))).state).toBe("valid");
  });

  it("enforces role, sequence and no self-review", () => {
    const priya = actors.find((a) => a.id === "st-01")!;
    const daniel = actors.find((a) => a.id === "st-02")!;
    const helen = actors.find((a) => a.id === "st-03")!;
    const l0 = buildLedger([fact("verification", "st-02", "SchB.1.1", { type: "agreed_to_source_document" })], actors);
    const snap = scopeSnapshot(investments, l0, effectiveReturn(packet, index, l0));
    const none = levels.map((level) => signoffStatus(investments, level, l0, snap));
    expect(canSignOff(priya, investments, "reviewer", levels, none, l0).allowed).toBe(false); // role
    expect(canSignOff(daniel, investments, "reviewer", levels, none, l0).reason).toMatch(/preparer sign-off first/);
    const signed = buildLedger([...l0.all.map(() => fact("verification", "st-02", "SchB.1.1", { type: "agreed_to_source_document" })), fact("signoff", "st-01", investments.id, { level: "preparer", scope: investments.id, hash: "x".repeat(64), snapshot: { facts: 0, lines: {}, adjustments: 0 } })], actors);
    const snap2 = scopeSnapshot(investments, signed, effectiveReturn(packet, index, signed));
    const withPrep = levels.map((level) => signoffStatus(investments, level, signed, snap2));
    // Preparer sign-off hash does not match the current snapshot, so it is reopened and blocks the reviewer.
    expect(withPrep.find((s) => s.level === "preparer")?.state).toBe("reopened");
    expect(canSignOff(helen, investments, "reviewer", levels, withPrep, signed).allowed).toBe(false);
    // With a valid preparer sign-off, Daniel is still refused because he verified a line in the scope.
    const valid = buildLedger([fact("verification", "st-02", "SchB.1.1", { type: "agreed_to_source_document" })], actors);
    const snap3 = scopeSnapshot(investments, valid, effectiveReturn(packet, index, valid));
    const valid2 = buildLedger([...valid.all.map((f) => ({ ...f, at: new Date(f.at) }) as unknown as Fact), fact("signoff", "st-01", investments.id, { level: "preparer", scope: investments.id, hash: snap3.hash, snapshot: { facts: snap3.facts, lines: snap3.lines, adjustments: 0 } })], actors);
    const statuses = levels.map((level) => signoffStatus(investments, level, valid2, scopeSnapshot(investments, valid2, effectiveReturn(packet, index, valid2))));
    expect(statuses.find((s) => s.level === "preparer")?.state).toBe("valid");
    expect(canSignOff(daniel, investments, "reviewer", levels, statuses, valid2).reason).toMatch(/may not review/);
    expect(canSignOff(helen, investments, "reviewer", levels, statuses, valid2).allowed).toBe(true);
  });
});
