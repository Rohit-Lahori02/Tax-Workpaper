import type { Check, Finding } from "./types";

/**
 * Hand-entered identifiers against the identity documents in the file. The
 * e-file database runs the same comparison and rejects the return on a miss,
 * so this is the cheapest possible rejection to catch early.
 */
const identityDocuments: Check = {
  id: "identity-documents",
  area: "documents",
  title: "Identifiers entered at intake match identity documents in the file",
  coverage: (ctx) => {
    const docs = ctx.packet.documents.filter((d) => d.document_type === "identity_document");
    return docs.length + " identity document(s) compared with the household record for " + ctx.packet.household.people.length + " people.";
  },
  run: (ctx) => {
    const out: Finding[] = [];
    for (const doc of ctx.packet.documents) {
      if (doc.document_type !== "identity_document") continue;
      const person = ctx.packet.household.people.find((p) => doc.belongs_to === "dependent:" + p.id || doc.belongs_to === p.id || doc.title.includes(p.name));
      if (!person) continue;
      for (const ev of ctx.packet.extracted_values) {
        if (ev.document_id !== doc.id || ev.field !== "ssn" || typeof ev.value !== "string" || !person.ssn) continue;
        if (ev.value.replace(/\D/g, "") === person.ssn.replace(/\D/g, "")) continue;
        out.push({
          id: "identity-documents:" + person.id,
          check: "identity-documents",
          area: "documents",
          severity: "error",
          title: person.name + ": SSN entered at intake differs from the Social Security card",
          detail: "The household record and " + doc.id + " disagree in the last digits (a transposition). The IRS e-file database will reject the return with R0000-504-02 until the entry is corrected.",
          refs: [doc.id, ev.id],
          expected: "as printed on " + doc.id,
          actual: "as entered",
        });
      }
    }
    return out;
  },
};

export const identityChecks: Check[] = [identityDocuments];
