"use client";

import { useState, useTransition } from "react";
import { cn } from "@/components/ui";
import { stepAction } from "@/lib/facts/actions-judgment";

export function StepToggle({ target, done, locked, allowed }: { target: string; done: boolean; locked: boolean; allowed: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!allowed || locked) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const fd = new FormData();
          fd.set("target", target);
          fd.set("done", String(!done));
          start(async () => {
            const r = await stepAction(fd);
            setError(r.ok ? null : r.error);
          });
        }}
        className={cn("rounded-full border px-2.5 py-1 text-[12px] font-medium", done ? "border-border text-muted hover:text-foreground" : "border-accent bg-accent-soft text-foreground", pending && "opacity-50")}
      >
        {done ? "Reopen" : "Mark complete"}
      </button>
      {error ? <span className="text-[12px] text-danger">{error}</span> : null}
    </span>
  );
}
