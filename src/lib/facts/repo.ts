import "server-only";
import { and, asc, eq, max } from "drizzle-orm";
import { cache } from "react";
import { getDb, hasDatabase } from "@/db/client";
import { blobs, facts, type Blob, type Fact, type NewFact } from "@/db/schema";
import { getPacket } from "@/lib/packet/load";
import { actorsFromPacket } from "@/lib/roles";
import { buildLedger, type Ledger } from "./ledger";

export interface LedgerState {
  ledger: Ledger;
  /** Human-readable reason the ledger is empty when the database is missing or down. */
  error: string | null;
}

/** The whole ledger for this engagement, read once per request. */
export const getLedger = cache(async (): Promise<LedgerState> => {
  const { packet } = getPacket();
  const actors = actorsFromPacket(packet);
  if (!hasDatabase()) {
    return { ledger: buildLedger([], actors), error: "DATABASE_URL is not set, so nothing can be saved yet." };
  }
  try {
    const rows = await getDb()
      .select()
      .from(facts)
      .where(eq(facts.clientId, packet.packet.client_id))
      .orderBy(asc(facts.seq));
    return { ledger: buildLedger(rows, actors), error: null };
  } catch (e) {
    console.error("ledger load failed", e);
    return { ledger: buildLedger([], actors), error: "The ledger database is unreachable. Showing the packet only." };
  }
});

/** Highest sequence number in the ledger, for cheap change detection. */
export async function maxSeq(): Promise<number> {
  if (!hasDatabase()) return 0;
  const clientId = getPacket().packet.packet.client_id;
  const rows = await getDb().select({ m: max(facts.seq) }).from(facts).where(eq(facts.clientId, clientId));
  const m = rows[0]?.m;
  return m === null || m === undefined ? 0 : Number(m);
}

type FactInput = Omit<NewFact, "id" | "seq" | "at" | "clientId">;

export async function insertFact(input: FactInput): Promise<Fact> {
  const clientId = getPacket().packet.packet.client_id;
  const [row] = await getDb()
    .insert(facts)
    .values({ ...input, clientId })
    .returning();
  return row;
}

export async function insertBlob(input: { actorId: string; name: string; mime: string; size: number; dataBase64: string }): Promise<Blob> {
  const clientId = getPacket().packet.packet.client_id;
  const [row] = await getDb()
    .insert(blobs)
    .values({ ...input, clientId })
    .returning();
  return row;
}

export async function getBlob(id: string): Promise<Blob | null> {
  const clientId = getPacket().packet.packet.client_id;
  const rows = await getDb()
    .select()
    .from(blobs)
    .where(and(eq(blobs.id, id), eq(blobs.clientId, clientId)))
    .limit(1);
  return rows[0] ?? null;
}
