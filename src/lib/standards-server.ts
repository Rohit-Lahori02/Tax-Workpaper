import "server-only";
import { cache } from "react";
import { getLedger } from "@/lib/facts/repo";
import { getPacket, type LoadedPacket } from "@/lib/packet/load";
import { applyStandards } from "@/lib/standards";

/** The packet with the firm's current standards applied. Same index: standards never change the return itself. */
export const getEffectivePacket = cache(async (): Promise<LoadedPacket> => {
  const loaded = getPacket();
  const { ledger } = await getLedger();
  return { ...loaded, packet: applyStandards(loaded.packet, ledger) };
});
