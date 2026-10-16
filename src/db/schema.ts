import { bigserial, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * The ledger. Every fact a person adds to the workpaper is one row here and
 * rows are never updated or deleted: a correction is a new fact whose
 * `supersedes` points at the old one. Everything the UI shows is computed by
 * reading the packet plus this table.
 */
export const facts = pgTable(
  "facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Monotonic order of arrival, used for "since I last looked" and replay. */
    seq: bigserial("seq", { mode: "number" }).notNull().unique(),
    /** packet.client_id, so one database can hold several engagements. */
    clientId: text("client_id").notNull(),
    /** verification | adjustment | note | question | judgment | signoff | assignment | time | standard | sensitive_view ... */
    kind: text("kind").notNull(),
    actorId: text("actor_id").notNull(),
    at: timestamp("at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    /** A packet reference in the packet's own format: ev-0703, F1040.11, D30, qa-14, asset:SAC-BLDG ... */
    target: text("target").notNull(),
    body: jsonb("body").$type<Record<string, unknown>>().notNull(),
    /** Facts written together by one bulk action share a batch id so they undo together. */
    batchId: uuid("batch_id"),
    supersedes: uuid("supersedes"),
  },
  (t) => [
    index("facts_client_target_idx").on(t.clientId, t.target),
    index("facts_client_seq_idx").on(t.clientId, t.seq),
  ],
);

export type Fact = typeof facts.$inferSelect;
export type NewFact = typeof facts.$inferInsert;
