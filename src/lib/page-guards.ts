import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/session";

/**
 * Pages that are the firm's working paper. A client who reaches one by URL
 * is sent to their own to-do list; the sidebar never offers these to them.
 */
export async function staffOnlyPage(): Promise<void> {
  const actor = await getCurrentActor();
  if (actor.kind !== "staff") redirect("/work");
}

/** The client's home is their to-do list; staff get the overview. */
export async function clientsGoTo(path: string): Promise<void> {
  const actor = await getCurrentActor();
  if (actor.kind === "client") redirect(path);
}
