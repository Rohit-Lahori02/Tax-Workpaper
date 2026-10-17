import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Fact } from "@/db/schema";
import { runChecks } from "@/lib/checks/run";
import { partnerThreshold, requiresPartner } from "@/lib/effective";
import { buildLedger } from "@/lib/facts/ledger";
import { buildIndex } from "@/lib/packet/index";
import { PacketSchema } from "@/lib/packet/schema";
import { actorsFromPacket } from "@/lib/roles";
import { search } from "@/lib/search";
import { variance } from "@/lib/variance";
import { applyStandards, parseStandardValue, STANDARD_DEFS, standardsView, timeByArea } from "./standards";

const packet = PacketSchema.parse(JSON.parse(readFileSync(path.join(process.cwd(), "data", "packet.json"), "utf8")) as unknown);
const index = buildIndex(packet);
const actors = actorsFromPacket(packet);
const checks = runChecks(packet, index);

let seq = 0;
function fact(kind: string, target: string, body: Record<string, unknown>, actorId = "st-05"): Fact {
  seq += 1;
  return { id: "00000000-0000-4000-8000-" + String(seq).padStart(12, "0"), seq, clientId: "c", kind, actorId, at: new Date(Date.UTC(2026, 9, seq)), target, body, batchId: null, supersedes: null } as Fact;
}
const def = (key: string) => STANDARD_DEFS.find((d) => d.key === key)!;

describe("firm standards overlay", () => {
  it("returns the packet untouched when nothing is overridden", () => {
    const ledger = buildLedger([], actors);
    expect(applyStandards(packet, ledger)).toBe(packet);
    expect(standardsView(packet, ledger).every((v) => !v.override)).toBe(true);
  });

  it("the latest live standard wins and feeds the rules that read the packet", () => {
    const f1 = fact("standard", "standard:partner_threshold", { key: "partner_threshold", value: 2500, text: "raise" });
    const f2 = fact("standard", "standard:variance_percent", { key: "variance_percent", value: 50, text: "fewer flags" });
    const ledger = buildLedger([f1, f2], actors);
    const eff = applyStandards(packet, ledger);
    expect(packet.firm.starter_standards.rules.some((r) => /over 1,000/.test(r))).toBe(true);
    expect(eff.firm.starter_standards.rules.some((r) => /over 2,500/.test(r))).toBe(true);
    expect(partnerThreshold(eff)).toBe(2500);
    expect(requiresPartner({ federal: 2000, california: 0, affectsTax: true }, eff)).toBe(false);
    expect(requiresPartner({ federal: 2000, california: 0, affectsTax: true }, packet)).toBe(true);
    // 20% up and 5,000 dollars: flagged under the starter 10%, not under 50%.
    expect(variance(30000, 25000, packet).flagged).toBe(true);
    expect(variance(30000, 25000, eff).flagged).toBe(false);
    // The packet object was not mutated.
    expect(partnerThreshold(packet)).toBe(1000);
  });

  it("a retraction reverts to the starter value", () => {
    const f1 = fact("standard", "standard:variance_amount", { key: "variance_amount", value: 5000, text: "x" });
    const r = fact("retract", "standard:variance_amount", { factId: f1.id });
    const view = standardsView(packet, buildLedger([f1, r], actors)).find((v) => v.def.key === "variance_amount")!;
    expect(view.override).toBeNull();
    expect(view.current).toBe(1000);
  });

  it("validates submitted values", () => {
    expect(parseStandardValue(def("verification_types"), "recalculated\nagreed_to_source_document\n")).toEqual(["recalculated", "agreed_to_source_document"]);
    expect(() => parseStandardValue(def("verification_types"), "Agreed To Source")).toThrow(/lowercase/);
    expect(parseStandardValue(def("budget_hours"), "business: 4\ncalifornia = 2.5")).toEqual({ business: 4, california: 2.5 });
    expect(() => parseStandardValue(def("partner_threshold"), "-5")).toThrow();
    expect(parseStandardValue(def("partner_threshold"), "$2,500")).toBe(2500);
    const merged = applyStandards(packet, buildLedger([fact("standard", "standard:budget_hours", { key: "budget_hours", value: { business: 9 }, text: "x" })], actors));
    expect(merged.firm.budget_hours.business).toBe(9);
    expect(merged.firm.budget_hours.california).toBe(packet.firm.budget_hours.california);
  });
});

describe("time vs budget", () => {
  it("sums quarter hours by area and person", () => {
    const ledger = buildLedger(
      [fact("time", "area:business", { hours: 1.5, date: "2026-10-01" }, "st-01"), fact("time", "area:business", { hours: 0.75, date: "2026-10-02" }, "st-04"), fact("time", "area:california", { hours: 2, date: "2026-10-02" }, "st-01")],
      actors,
    );
    const t = timeByArea(packet, ledger);
    const business = t.find((x) => x.area === "business")!;
    expect(business.logged).toBe(2.25);
    expect(business.budget).toBe(packet.firm.budget_hours.business);
    expect(business.byPerson.map((p) => p.hours)).toEqual([1.5, 0.75]);
    expect(t.find((x) => x.area === "california")!.logged).toBe(2);
  });
});

describe("search", () => {
  const ledger = buildLedger([fact("note", "SchC.1", { text: "Paywell deposits already in the books", blocking: false }, "st-01")], actors);
  const opts = { staff: true, literals: [] };

  it("finds documents, values, lines and client answers for a word", () => {
    const r = search(packet, index, ledger, checks, "Paywell", opts);
    expect(r.total).toBeGreaterThan(0);
    const groups = r.byGroup.map((g) => g.group);
    expect(groups).toContain("documents");
    expect(groups).toContain("records");
    expect(r.byGroup.find((g) => g.group === "documents")!.hits.some((h) => h.id === "D21")).toBe(true);
  });

  it("requires every term, ranks exact ids first and hides the ledger from clients", () => {
    expect(search(packet, index, ledger, checks, "Paywell zzzzqqq", opts).total).toBe(0);
    const r = search(packet, index, ledger, checks, "D21", opts);
    expect(r.exact).toBe("/documents/D21");
    const client = search(packet, index, ledger, checks, "Paywell", { staff: false, literals: [] });
    expect(client.byGroup.some((g) => g.group === "records")).toBe(false);
  });

  it("masks sensitive literals in results", () => {
    const ssn = packet.household.people[0].ssn!;
    const r = search(packet, index, ledger, checks, "Ngozi", { staff: true, literals: [ssn] });
    expect(r.hits.some((h) => h.detail.includes(ssn) || h.title.includes(ssn))).toBe(false);
  });
});
