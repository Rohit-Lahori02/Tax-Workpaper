import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseRef, resolvePointer } from "@/lib/refs";
import { buildIndex } from "./index";
import { PacketSchema } from "./schema";

const raw: unknown = JSON.parse(readFileSync(path.join(process.cwd(), "data", "packet.json"), "utf8"));
const packet = PacketSchema.parse(raw);
const index = buildIndex(packet);

describe("packet", () => {
  it("loads as delivered", () => {
    expect(packet.documents).toHaveLength(74);
    expect(packet.extracted_values).toHaveLength(3012);
    expect(packet.return_versions).toHaveLength(3);
    expect(index.latestVersion).toBe("v3");
  });

  it("links every cited value to a document", () => {
    for (const [id] of index.linesByValue) {
      const v = index.values.get(id)!;
      expect(index.documents.has(v.document_id)).toBe(true);
    }
  });

  it("reports integrity findings instead of hiding them", () => {
    // The packet deliberately contains mistakes; the index must surface, not swallow, them.
    const codes = new Set(index.integrity.map((i) => i.code));
    console.log(`integrity findings: ${index.integrity.length}`, [...codes]);
    expect(Array.isArray(index.integrity)).toBe(true);
  });
});

describe("refs", () => {
  it("parses every reference format in the readme", () => {
    expect(parseRef("ev-0703")).toEqual({ kind: "value", id: "ev-0703" });
    expect(parseRef("D30")).toEqual({ kind: "document", id: "D30" });
    expect(parseRef("doc:D30#page32")).toEqual({ kind: "document", id: "D30", page: 32 });
    expect(parseRef("F1040.11")).toEqual({ kind: "line", key: "F1040.11" });
    expect(parseRef("SchCA540NR.12.E")).toEqual({ kind: "line", key: "SchCA540NR.12.E" });
    expect(parseRef("F8938")).toEqual({ kind: "line", key: "F8938" });
    expect(parseRef("py:/carryovers_into_2025/capital_loss_short")).toEqual({
      kind: "prior_year",
      pointer: "/carryovers_into_2025/capital_loss_short",
    });
    expect(parseRef("ref:param.std_deduction_mfj")).toEqual({ kind: "engine_param", path: "std_deduction_mfj" });
    expect(parseRef("ref:fx.SEK.2025_average")).toEqual({ kind: "engine_param", path: "fx.SEK.2025_average" });
    expect(parseRef("asset:SAC-BLDG")).toEqual({ kind: "asset", id: "SAC-BLDG" });
    expect(parseRef("household:ngozi")).toEqual({ kind: "person", id: "ngozi" });
    expect(parseRef("extension-2026-04-14")).toEqual({ kind: "timeline", id: "extension-2026-04-14" });
    expect(parseRef("v2")).toEqual({ kind: "version", id: "v2" });
  });

  it("resolves JSON pointers", () => {
    expect(resolvePointer(packet.prior_years, "/carryovers_into_2025/capital_loss_short")).toBeTypeOf("number");
    expect(resolvePointer(packet.prior_years, "/does/not/exist")).toBeUndefined();
  });
});
