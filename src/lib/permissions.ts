import { canViewSensitive, type Actor } from "@/lib/roles";

/**
 * Who may do what. Pure functions used both to gate the UI and, on the
 * server, to refuse an action. The firm's starter standards are the source.
 */

export type ActorLite = Pick<Actor, "id" | "name" | "role" | "kind">;

const REVIEW_ROLES = new Set(["reviewer", "partner", "quality_reviewer"]);
const PREP_ROLES = new Set(["preparer", "reviewer", "partner", "quality_reviewer"]);

export const canVerify = (a: ActorLite) => a.kind === "staff" && PREP_ROLES.has(a.role);
export const canNote = (a: ActorLite) => a.kind === "staff";
/** "Open review notes block filing": only reviewers and above may raise a blocking note. */
export const canBlock = (a: ActorLite) => a.kind === "staff" && REVIEW_ROLES.has(a.role);
export const canAsk = (a: ActorLite) => a.kind === "staff";
export const canAttach = (a: ActorLite) => a.kind === "staff" || a.kind === "client";
/** A question to the client may be answered by the client, or recorded on their behalf by staff. */
export const canAnswer = (a: ActorLite, to: string) =>
  to === "client" ? true : a.kind === "staff" && (a.id === to || a.role === "partner");
export const canRetract = (a: ActorLite, authorId: string) => a.id === authorId || a.role === "partner";
export const canResolve = (a: ActorLite, authorId: string) => a.kind === "staff" && (a.id === authorId || REVIEW_ROLES.has(a.role));
export const canReveal = (a: Actor) => canViewSensitive(a);
export const canSeeLedger = (a: ActorLite) => a.kind === "staff";
/** Changing a number on the return is preparer-and-above work; the client never does it. */
export const canAdjust = (a: ActorLite) => a.kind === "staff" && PREP_ROLES.has(a.role);
export const canUndoBatch = (a: ActorLite, authorIds: string[]) => a.role === "partner" || authorIds.every((id) => id === a.id);
