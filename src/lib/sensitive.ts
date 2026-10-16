import "server-only";
import { after } from "next/server";
import { hasDatabase } from "@/db/client";
import { insertFact } from "@/lib/facts/repo";
import type { Actor } from "@/lib/roles";

/**
 * Firm rule: every unmasked view of SSNs, bank or account numbers and IP PINs
 * is logged. Called by a page after it has decided to render them unmasked;
 * the write happens after the response is sent so it never slows the page.
 */
export function logSensitiveView(actor: Actor, page: string, fields: string[]) {
  if (fields.length === 0 || !hasDatabase()) return;
  after(async () => {
    try {
      await insertFact({ kind: "sensitive_view", actorId: actor.id, target: page, body: { fields } });
    } catch (e) {
      console.error("sensitive view log failed", e);
    }
  });
}
