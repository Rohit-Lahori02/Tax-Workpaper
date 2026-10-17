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

/** The person acting in this browser: an avatar chip whose whole surface is the select. */
export function RoleSwitcher({ actors, currentId }: { actors: Actor[]; currentId: string }) {
  const [pending, startTransition] = useTransition();
  const current = actors.find((a) => a.id === currentId) ?? actors[0];
  return (
    <form action={switchActor} className={cn("relative flex h-8 items-center gap-2 rounded-lg border border-border bg-surface pl-1 pr-7 shadow-[var(--card-inset)] hover:border-border-strong", pending && "opacity-60")} title={current.note ?? ROLE_LABELS[current.role]}>
      <span className={cn("flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold", current.kind === "client" ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent")}>{initials(current.name)}</span>
      <span className="hidden flex-col leading-none sm:flex">
        <span className="text-[12px] font-medium">{current.name}</span>
        <span className="mt-0.5 text-[10.5px] text-muted">{ROLE_LABELS[current.role]}</span>
      </span>
      <select
        aria-label="Acting as"
        name="actor"
        defaultValue={currentId}
        disabled={pending}
        suppressHydrationWarning
        onChange={(e) => {
          const data = new FormData(e.currentTarget.form ?? undefined);
          startTransition(() => switchActor(data));
        }}
        className="absolute inset-0 w-full cursor-pointer appearance-none opacity-0"
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
