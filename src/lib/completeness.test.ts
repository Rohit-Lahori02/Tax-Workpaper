import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Fact } from "@/db/schema";
import { runChecks } from "@/lib/checks/run";
import { effectiveReturn } from "@/lib/effective";
import { buildLedger } from "@/lib/facts/ledger";
import { buildIndex } from "@/lib/packet/index";
import { PacketSchema } from "@/lib/packet/schema";
import { actorsFromPacket } from "@/lib/roles";
import { areaStatuses, decisionPoints, documentAccounting, dueDiligenceItems, outsideFilings, requiredSteps, varianceItems } from "./completeness";

const raw: unknown = JSON.parse(readFileSync(path.join(process.cwd(), "data", "packet.json"), "utf8"));
const packet = PacketSchema.parse(raw);
const index = buildIndex(packet);
const actors = actorsFromPacket(packet);
const checks = runChecks(packet, index);

function fact(kind: string, target: string, body: Record<string, unknown>, seq: number): Fact {
  return { id: crypto.randomUUID(), seq, clientId: "CL-20417", kind, actorId: "st-01", at: new Date(2026, 6, seq), target, body, batchId: null, supersedes: null };
}

describe("completeness on the delivered packet", () => {
  const ledger = buildLedger([], actors);
  const eff = effectiveReturn(packet, index, ledger);

  it("flags swings against 2024 that need an explanation", () => {
    const v = varianceItems(packet, index, ledger, eff);
    expect(v.length).toBeGreaterThan(10);
    expect(v.every((x) => !x.explanation)).toBe(true);
    expect(v.find((x) => x.key === "F1040.11")?.diff).toBe(445590 - 228409);
  });

  it("derives decision points from what-ifs and diagnostics", () => {
    const d = decisionPoints(packet, index, ledger);
    const equipment = d.find((x) => x.id === "equipment");
    expect(equipment?.options.map((o) => o.id)).toEqual(["engine", "equipment_section179", "equipment_no_bonus"]);
    expect(equipment?.current).toBe("engine");
    expect(d.some((x) => x.target === "diag:CA_AMT_NOT_COMPUTED")).toBe(true);
    expect(d.some((x) => x.target === "diag:FBAR_OUTSIDE_RETURN")).toBe(false);
  });

  it("knows which credits need due diligence", () => {
    const dd = dueDiligenceItems(packet, index, ledger);
    expect(dd.find((x) => x.id === "ctc")?.applicable).toBe(true);
    expect(dd.find((x) => x.id === "odc")?.applicable).toBe(true);
    expect(dd.find((x) => x.id === "aotc")?.applicable).toBe(false);
    expect(dd.find((x) => x.id === "hoh")?.applicable).toBe(false);
  });

  it("lists filings outside the return", () => {
    const ids = outsideFilings(packet, index, ledger).map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["fbar", "forms-1099-nec", "form-3520", "composite-oregon", "composite-arizona", "related-ada"]));
  });

  it("accounts for documents and computes the required steps", () => {
    const docs = documentAccounting(index, ledger);
    const unaccounted = docs.filter((d) => !d.accounted);
    expect(unaccounted.length).toBeGreaterThan(5);
    const steps = requiredSteps(packet, index, ledger, { variances: varianceItems(packet, index, ledger, eff), dueDiligence: dueDiligenceItems(packet, index, ledger), decisions: decisionPoints(packet, index, ledger), documents: docs, checks });
    expect(steps).toHaveLength(12);
    expect(steps[0].done).toBe(true); // engagement letter and consent are in the file
    expect(steps[3].done).toBe(false); // documents unaccounted
    expect(steps[6].auto).toBe("blocked"); // payments disagree with the IRS and FTB
    expect(steps[9].auto).toBe("later");
  });

  it("completes steps as facts arrive", () => {
    const eff2 = eff;
    const facts: Fact[] = [];
    let seq = 1;
    for (const d of documentAccounting(index, buildLedger([], actors)).filter((x) => !x.accounted)) {
      facts.push(fact("disposition", d.doc.id, { disposition: "reference_only" }, seq++));
    }
    facts.push(fact("judgment", "dd:ctc", { type: "due_diligence", text: "done", answers: [true, true, true, true, true] }, seq++));
    facts.push(fact("judgment", "dd:odc", { type: "due_diligence", text: "done", answers: [true, true, true, true, true] }, seq++));
    const ledger2 = buildLedger(facts, actors);
    const steps = requiredSteps(packet, index, ledger2, { variances: varianceItems(packet, index, ledger2, eff2), dueDiligence: dueDiligenceItems(packet, index, ledger2), decisions: decisionPoints(packet, index, ledger2), documents: documentAccounting(index, ledger2), checks });
    expect(steps[3].done).toBe(true);
    expect(steps[7].done).toBe(true);
    const areas = areaStatuses(packet, index, ledger2, checks);
    expect(areas.find((a) => a.id === "california")?.checkErrors).toBeGreaterThan(0);
    expect(areas.find((a) => a.id === "business")?.lines).toBeGreaterThan(20);
  });
});
