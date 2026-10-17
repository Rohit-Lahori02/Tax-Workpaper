import "server-only";
import { cookies } from "next/headers";
import { sensitiveLiterals } from "@/lib/mask";
import { getPacket } from "@/lib/packet/load";
import { ACTOR_COOKIE, actorsFromPacket, canViewSensitive, defaultActorId, type Actor } from "@/lib/roles";

export const REVEAL_COOKIE = "wp_reveal";
export const NOW_COOKIE = "wp_now";

export interface Now {
  /** ISO timestamp the file is being viewed "as of". */
  iso: string;
  /** True when a replay cursor is set; false when it is the real clock. */
  replay: boolean;
}

/** The moment the viewer is standing at: the real clock, or a replay cursor set on the timeline. */
export async function getNow(): Promise<Now> {
  const jar = await cookies();
  const raw = jar.get(NOW_COOKIE)?.value;
  if (raw && !Number.isNaN(Date.parse(raw))) return { iso: new Date(raw).toISOString(), replay: true };
  return { iso: new Date().toISOString(), replay: false };
}

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

/**
 * Sensitive data is masked for everyone by default. Cleared staff can switch
 * unmasking on for a session; pages that then show it log the view.
 */
export async function getReveal(actor: Actor): Promise<boolean> {
  if (!canViewSensitive(actor)) return false;
  const jar = await cookies();
  return jar.get(REVEAL_COOKIE)?.value === "1";
}

export interface Viewer {
  actor: Actor;
  /** True when sensitive values should render unmasked. */
  reveal: boolean;
  /** Literals to scrub from free text when masked. Empty when revealed. */
  literals: string[];
}

export async function getViewer(): Promise<Viewer> {
  const actor = await getCurrentActor();
  const reveal = await getReveal(actor);
  return { actor, reveal, literals: reveal ? [] : sensitiveLiterals(getPacket().packet) };
}
