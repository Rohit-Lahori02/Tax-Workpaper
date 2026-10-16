"use client";

import { ChevronDown } from "lucide-react";
import { useTransition } from "react";
import { cn } from "@/components/ui";
import { switchActor } from "@/lib/actions";
import { ROLE_LABELS, type Actor } from "@/lib/roles";

export function RoleSwitcher({ actors, currentId }: { actors: Actor[]; currentId: string }) {
  const [pending, startTransition] = useTransition();
  const current = actors.find((a) => a.id === currentId) ?? actors[0];
  return (
    <form
      action={switchActor}
      className={cn("relative flex h-8 items-center rounded-full border border-border bg-surface pl-3 pr-2 text-[12.5px]", pending && "opacity-60")}
      title={current.note ?? ROLE_LABELS[current.role]}
    >
      <span className="mr-1.5 text-muted">Viewing as</span>
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
        className="appearance-none bg-transparent pr-5 font-medium outline-none"
      >
        {actors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {ROLE_LABELS[a.role]}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted" />
    </form>
  );
}
