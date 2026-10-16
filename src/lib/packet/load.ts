import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildIndex, type PacketIndex } from "./index";
import { PacketSchema, type Packet } from "./schema";

export interface LoadedPacket {
  packet: Packet;
  index: PacketIndex;
}

let cached: LoadedPacket | null = null;

/**
 * The packet as delivered, validated once per server process and indexed.
 * Never mutate what this returns.
 */
export function getPacket(): LoadedPacket {
  if (cached) return cached;
  const file = process.env.PACKET_PATH ?? path.join(process.cwd(), "data", "packet.json");
  const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
  const parsed = PacketSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Packet at ${file} failed validation:\n${first.join("\n")}`);
  }
  cached = { packet: parsed.data, index: buildIndex(parsed.data) };
  return cached;
}
