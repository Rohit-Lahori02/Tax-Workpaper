"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ACTOR_COOKIE } from "@/lib/roles";
import { listActors } from "@/lib/session";

export async function switchActor(formData: FormData): Promise<void> {
  const id = String(formData.get("actor") ?? "");
  if (!listActors().some((a) => a.id === id)) {
    throw new Error("Unknown actor");
  }
  const jar = await cookies();
  jar.set(ACTOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/", "layout");
}
