"use client";

import { ChevronsUpDown } from "lucide-react";
import { useTransition } from "react";
import { cn } from "@/components/ui";
import { switchActor } from "@/lib/actions";
import { ROLE_LABELS, type Actor } from "@/lib/roles";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function RoleSwitcher({ actors, currentId }: { actors: Actor[]; currentId: string }) {
  const [pending, startTransition] = useTransition();
  const current = actors.find((a) => a.id === currentId) ?? actors[0];
  return (
    <form
      action={switchActor}
      className={cn(
        "relative flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-2 text-[13px]",
        pending && "opacity-60",
      )}
      title={current.note ?? ROLE_LABELS[current.role]}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">
        {initials(current.name)}
      </span>
      <select
        aria-label="Acting as"
        name="actor"
        defaultValue={currentId}
        disabled={pending}
        onChange={(e) => {
          const data = new FormData(e.currentTarget.form ?? undefined);
          startTransition(() => switchActor(data));
        }}
        className="appearance-none bg-transparent pr-5 font-medium outline-none"
      >
        {actors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {ROLE_LABELS[a.role]}
          </option>
        ))}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted" />
    </form>
  );
}
