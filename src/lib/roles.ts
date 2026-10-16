import type { Packet, StaffRole } from "@/lib/packet/schema";

export type Role = StaffRole | "client";

export interface Actor {
  id: string;
  name: string;
  role: Role;
  kind: "staff" | "client";
  credential: string | null;
  sensitiveDataClearance: boolean;
  activeFrom: string | null;
  note?: string;
}

export const ACTOR_COOKIE = "wp_actor";

export const ROLE_LABELS: Record<Role, string> = {
  preparer: "Preparer",
  reviewer: "Reviewer",
  partner: "Partner",
  firm_administrator: "Firm administrator",
  quality_reviewer: "Quality reviewer",
  client: "Client",
};

/** Everyone who can act in the workpaper: firm staff and the client's users. */
export function actorsFromPacket(packet: Packet): Actor[] {
  const staff: Actor[] = packet.firm.staff.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    kind: "staff",
    credential: s.credential,
    sensitiveDataClearance: s.sensitive_data_clearance,
    activeFrom: s.active_from,
    note: s.note,
  }));
  const clients: Actor[] = packet.firm.client_users.map((c) => ({
    id: c.id,
    name: c.name,
    role: "client",
    kind: "client",
    credential: null,
    sensitiveDataClearance: false,
    activeFrom: null,
  }));
  return [...staff, ...clients];
}

export function defaultActorId(packet: Packet): string {
  return packet.firm.assignment_at_start.preparer;
}

/**
 * Firm rule: staff without sensitive-data clearance see SSNs, bank and account
 * numbers and IP PINs masked. Clients see their own data masked too; the
 * workpaper is the firm's record, not the client's portal.
 */
export function canViewSensitive(actor: Actor): boolean {
  return actor.kind === "staff" && actor.sensitiveDataClearance;
}
