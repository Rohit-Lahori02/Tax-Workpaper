"use client";

import { useTransition } from "react";
import { switchActor } from "@/lib/actions";
import { ROLE_LABELS, type Actor } from "@/lib/roles";

export function RoleSwitcher({ actors, currentId }: { actors: Actor[]; currentId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <form action={switchActor} className="flex items-center gap-2 text-sm">
      <label htmlFor="actor" className="text-muted">
        Acting as
      </label>
      <select
        id="actor"
        name="actor"
        defaultValue={currentId}
        disabled={pending}
        onChange={(e) => {
          const data = new FormData(e.currentTarget.form ?? undefined);
          startTransition(() => switchActor(data));
        }}
        className="rounded-md border border-border bg-surface px-2 py-1"
      >
        {actors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {ROLE_LABELS[a.role]}
          </option>
        ))}
      </select>
    </form>
  );
}
