import type { Packet } from "@/lib/packet/schema";

export interface Variance {
  diff: number;
  pct: number | null;
  flagged: boolean;
}

/**
 * Firm standard: flag a line that moved more than N percent and more than $M
 * against the comparison year. Both thresholds must be crossed.
 */
export function variance(current: number, prior: number, packet: Packet): Variance {
  const rule = packet.firm.starter_standards.variance_review;
  const diff = current - prior;
  const pct = prior === 0 ? null : Math.abs(diff) / Math.abs(prior);
  const overPct = pct === null ? diff !== 0 : pct * 100 > rule.flag_if_change_over_percent;
  const flagged = overPct && Math.abs(diff) > rule.and_over_amount;
  return { diff, pct, flagged };
}
