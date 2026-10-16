import { describe, expect, it } from "vitest";
import type { Fact } from "@/db/schema";
import type { Actor } from "@/lib/roles";
import { buildLedger } from "./ledger";

const actors: Actor[] = [
  { id: "st-01", name: "Priya Raman", role: "preparer", kind: "staff", credential: null, sensitiveDataClearance: true, activeFrom: "2025-08-01" },
  { id: "st-02", name: "Daniel Ortiz", role: "reviewer", kind: "staff", credential: "CPA", sensitiveDataClearance: true, activeFrom: "2021-01-04" },
  { id: "cu-01", name: "Ngozi Okafor", role: "client", kind: "client", credential: null, sensitiveDataClearance: false, activeFrom: null },
];

let seq = 0;
function fact(kind: string, actorId: string, target: string, body: Record<string, unknown>, id = crypto.randomUUID()): Fact {
  seq += 1;
  return { id, seq, clientId: "CL-1", kind, actorId, at: new Date(2026, 2, seq), target, body, batchId: null, supersedes: null };
}

describe("ledger", () => {
  it("folds retractions, resolutions and answers into their parents", () => {
    const noteId = crypto.randomUUID();
    const qId = crypto.randomUUID();
    const verId = crypto.randomUUID();
    const ledger = buildLedger(
      [
        fact("verification", "st-01", "F1040.1a", { type: "agreed_to_source_document" }, verId),
        fact("note", "st-02", "F1040.1a", { text: "Second W-2 photo is a duplicate", blocking: true }, noteId),
        fact("question", "st-01", "SchC.1", { text: "Were the 1099-K deposits already in the books?", to: "client" }, qId),
        fact("resolve", "st-02", "F1040.1a", { factId: noteId }),
        fact("retract", "st-01", "F1040.1a", { factId: verId, reason: "wrong line" }),
        fact("answer", "cu-01", "SchC.1", { questionId: qId, text: "Yes, all of them." }),
      ],
      actors,
    );

    const wages = ledger.summary("F1040.1a");
    expect(wages.verifications).toEqual([]);
    expect(wages.openNotes).toBe(0);
    expect(wages.blockingOpen).toBe(0);
    expect(wages.total).toBe(1);

    const gross = ledger.summary("SchC.1");
    expect(gross.openQuestions).toBe(0);
    expect(ledger.questions[0].answers[0].actorName).toBe("Ngozi Okafor");

    expect(ledger.forTarget("F1040.1a").map((f) => f.kind)).toEqual(["note", "verification"]);
    expect(ledger.byId.get(verId)?.retracted).toBe(true);
    expect(ledger.byId.get(noteId)?.resolved).toBe(true);
  });

  it("counts open questions and blocking notes", () => {
    const ledger = buildLedger(
      [
        fact("question", "st-01", "D30", { text: "Which 1099 is final?", to: "client" }),
        fact("note", "st-02", "D30", { text: "Do not file until the corrected 1099 is reconciled", blocking: true }),
        fact("sensitive_view", "st-02", "/", { fields: ["ssn:ngozi"] }),
      ],
      actors,
    );
    const s = ledger.summary("D30");
    expect(s.openQuestions).toBe(1);
    expect(s.blockingOpen).toBe(1);
    expect(s.total).toBe(2);
    expect(ledger.forTarget("/").length).toBe(0);
  });
});
