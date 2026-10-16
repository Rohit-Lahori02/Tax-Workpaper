import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Fact } from "@/db/schema";
import { buildLedger } from "@/lib/facts/ledger";
import { buildIndex } from "@/lib/packet/index";
import { PacketSchema } from "@/lib/packet/schema";
import { actorsFromPacket } from "@/lib/roles";
import { categoryFor, effectFor, effectiveReturn, findSigns, requiresPartner } from "./effective";

const raw: unknown = JSON.parse(readFileSync(path.join(process.cwd(), "data", "packet.json"), "utf8"));
const packet = PacketSchema.parse(raw);
const index = buildIndex(packet);
const actors = actorsFromPacket(packet);
const v3 = index.versions.get("v3")!;

let seq = 0;
function adjustment(key: string, newValue: number, category = categoryFor(key), id = crypto.randomUUID()): Fact {
  seq += 1;
  const engineValue = index.lines.get("v3")!.get(key)!.value as number;
  const delta = newValue - engineValue;
  const effect = effectFor(category, delta, v3);
  return {
    id,
    seq,
    clientId: "CL-20417",
    kind: "adjustment",
    actorId: "st-02",
    at: new Date(2026, 6, seq),
    target: key,
    body: { engineValue, newValue, delta, reason: "test", category, effect, requiresPartner: requiresPartner(effect, packet) },
    batchId: null,
    supersedes: null,
  };
}

describe("effective return", () => {
  it("recovers the engine's sign pattern", () => {
    expect(findSigns([480987, 35397], 445590)).toEqual([1, -1]);
    expect(findSigns([10, 20], 30)).toEqual([1, 1]);
  });

  it("pushes an adjustment through the arithmetic lines that depend on it", () => {
    const ledger = buildLedger([adjustment("SchB.1.2", 0)], actors);
    const eff = effectiveReturn(packet, index, ledger);
    expect(eff.adjustments).toHaveLength(1);
    expect(eff.value("SchB.1.2")).toBe(0);
    expect(eff.value("SchB.2")).toBe(6450 - 1840);
    expect(eff.value("SchB.4")).toBe(6450 - 1840);
    expect(eff.value("F1040.2b")).toBe(6450 - 1840);
    expect(eff.value("F1040.9")).toBe(480987 - 1840);
    expect(eff.value("F1040.11")).toBe(445590 - 1840);
    expect(eff.lines.get("F1040.11")?.kind).toBe("derived");
    // Taxable income depends on a deduction choice the engine owns; it is blocked, not guessed.
    expect(eff.blocked.some((l) => l.key === "F1040.16" || l.key === "SchA.5e")).toBe(true);
    expect(eff.effect.federal).toBe(Math.round(-1840 * 0.348));
    expect(eff.workingSummary.federal.total_tax).toBe(v3.summary.federal.total_tax + eff.effect.federal);
  });

  it("treats a payment correction as a balance change, not a tax change", () => {
    const ledger = buildLedger([adjustment("F1040.26", 12000)], actors);
    const eff = effectiveReturn(packet, index, ledger);
    expect(eff.effect.federal).toBe(1000);
    expect(eff.effect.federalTax).toBe(0);
    expect(eff.workingSummary.federal.balance_due).toBe(v3.summary.federal.balance_due + 1000);
    expect(eff.workingSummary.federal.payments).toBe(v3.summary.federal.payments - 1000);
    expect(eff.value("F1040.33")).toBe(77742 - 1000);
  });

  it("lets a retraction undo the adjustment", () => {
    const a = adjustment("SchB.1.2", 0);
    seq += 1;
    const retract: Fact = { id: crypto.randomUUID(), seq, clientId: "CL-20417", kind: "retract", actorId: "st-02", at: new Date(), target: a.target, body: { factId: a.id }, batchId: null, supersedes: a.id };
    const eff = effectiveReturn(packet, index, buildLedger([a, retract], actors));
    expect(eff.adjustments).toHaveLength(0);
    expect(eff.changed).toHaveLength(0);
  });

  it("flags partner sign-off above the firm threshold", () => {
    expect(requiresPartner({ federal: 1001, california: 0, affectsTax: true }, packet)).toBe(true);
    expect(requiresPartner({ federal: 900, california: 900, affectsTax: true }, packet)).toBe(false);
  });
});
