import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: Db | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Lazily connected so pages that only read the packet never need a database.
 * Neon hosts use the HTTP driver (works on serverless); anything else, such as
 * a local Docker Postgres, uses a normal TCP connection.
 */
export function getDb(): Db {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  const host = new URL(url).hostname;
  const useNeon = process.env.DATABASE_DRIVER === "neon" || (/\.neon\.tech$/i.test(host) && process.env.DATABASE_DRIVER !== "postgres");
  db = useNeon
    ? (drizzleNeon(neon(url), { schema }) as unknown as Db)
    : (drizzlePostgres(postgres(url, { max: 5, prepare: false }), { schema }) as unknown as Db);
  return db;
}
