import "server-only";
import { cookies } from "next/headers";
import { getPacket } from "@/lib/packet/load";
import { ACTOR_COOKIE, actorsFromPacket, defaultActorId, type Actor } from "@/lib/roles";

export function listActors(): Actor[] {
  return actorsFromPacket(getPacket().packet);
}

/** The person acting in this browser session, chosen with the role switcher. */
export async function getCurrentActor(): Promise<Actor> {
  const { packet } = getPacket();
  const actors = actorsFromPacket(packet);
  const jar = await cookies();
  const id = jar.get(ACTOR_COOKIE)?.value;
  return actors.find((a) => a.id === id) ?? actors.find((a) => a.id === defaultActorId(packet)) ?? actors[0];
}
