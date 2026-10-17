import "server-only";
import { getEffectivePacket } from "@/lib/standards-server";
import type { ActorLite } from "@/lib/permissions";
import { getCurrentActor } from "@/lib/session";
import type { StaffOption } from "@/components/facts/facts-panel";

export interface FactsContext {
  actor: ActorLite;
  staff: StaffOption[];
  verificationTypes: string[];
}

/** Everything a FactsPanel needs besides the facts themselves. */
export async function factsContext(): Promise<FactsContext> {
  const { packet } = await getEffectivePacket();
  const a = await getCurrentActor();
  return {
    actor: { id: a.id, name: a.name, role: a.role, kind: a.kind },
    staff: packet.firm.staff.map((s) => ({ id: s.id, name: s.name })),
    verificationTypes: packet.firm.starter_standards.verification_types,
  };
}
