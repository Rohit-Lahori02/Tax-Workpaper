import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildIndex } from "@/lib/packet/index";
import { PacketSchema } from "@/lib/packet/schema";
import { signedCombinationMatches } from "./lines";
import { runChecks } from "./run";

const raw: unknown = JSON.parse(readFileSync(path.join(process.cwd(), "data", "packet.json"), "utf8"));
const packet = PacketSchema.parse(raw);
const index = buildIndex(packet);
const run = runChecks(packet, index);
const ids = new Set(run.findings.map((f) => f.id));

describe("signed combination", () => {
  it("accepts sums and differences", () => {
    expect(signedCombinationMatches([480987, 35397], 445590)).toBe(true);
    expect(signedCombinationMatches([10, 20], 31)).toBe(true); // within a dollar
    expect(signedCombinationMatches([10, 20], 33)).toBe(false);
  });
});

describe("checks against the delivered packet", () => {
  it("runs every check without crashing", () => {
    expect(run.findings.some((f) => f.id.endsWith(":crashed"))).toBe(false);
    expect(run.counts.checks).toBeGreaterThan(20);
  });

  it("finds the Northlake interest counted from two documents", () => {
    expect([...ids].some((id) => id.startsWith("payer-duplicates:SchB.1.1:SchB.1.2"))).toBe(true);
  });

  it("finds the 2024 exchange rate on 2025 Swedish interest", () => {
    expect(ids.has("fx-rate-year:SchB.1.6")).toBe(true);
  });

  it("finds federal estimates that exceed the IRS transcript", () => {
    const f = run.findings.find((x) => x.id === "federal-estimates:F1040.26");
    expect(f?.difference).toBe(-1000);
  });

  it("finds California estimates that include a payment the FTB applied to 2024", () => {
    const f = run.findings.find((x) => x.id === "california-estimates:F540NR.72");
    expect(f?.difference).toBe(-3500);
  });

  it("accepts lot gains that use a supplemental adjusted basis", () => {
    // F8949.A.N2 uses the stock-plan supplement's basis (4,500) rather than the broker's 3,825; the engine is right.
    expect(run.findings.filter((x) => x.check === "lot-math")).toEqual([]);
  });

  it("finds the Meridian lot left on the unread page", () => {
    const f = run.findings.find((x) => x.id === "broker-summary:D31");
    expect(f?.difference).toBeCloseTo(250, 2);
  });

  it("finds the vehicle gift claimed above the 1098-C proceeds", () => {
    const f = run.findings.find((x) => x.id.startsWith("vehicle-gift:"));
    expect(f?.difference).toBe(-3100);
  });

  it("finds the phone, internet and Spotify business-use issues", () => {
    const bu = run.findings.filter((x) => x.check === "business-use");
    expect(bu.length).toBe(3);
  });

  it("finds the 1099-K counted on top of the payer's 1099-NEC", () => {
    expect(ids.has("gross-receipts:k-double-count")).toBe(true);
  });

  it("finds wages fully sourced to California after the move", () => {
    const f = run.findings.find((x) => x.id === "part-year-wages:SchCA540NR.1.E");
    expect(f).toBeTruthy();
    expect((f?.difference ?? 0) < 0).toBe(true);
  });

  it("reports no arithmetic failures on the delivered return", () => {
    expect(run.findings.filter((f) => f.check === "sum-lines" && f.severity === "error")).toEqual([]);
    expect(run.findings.filter((f) => f.check === "prior-year-carry")).toEqual([]);
    expect(run.findings.filter((f) => f.check === "depreciation")).toEqual([]);
    // Multi-column rows with incomplete input lists are reported as information, not errors.
    expect(run.findings.filter((f) => f.check === "sum-lines" && f.severity === "info").length).toBe(4);
  });
});
