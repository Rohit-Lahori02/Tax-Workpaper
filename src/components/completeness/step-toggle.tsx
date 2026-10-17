"use client";

import { AlertTriangle, Check, RotateCcw } from "lucide-react";
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
        className={cn("pill h-7 px-2.5 text-[12px]", !done && "primary", pending && "opacity-50")}
      >
        {done ? <RotateCcw className="h-3 w-3" /> : <Check className="h-3 w-3" />}
        {pending ? "Saving…" : done ? "Reopen" : "Mark complete"}
      </button>
      {error ? (
        <span className="flex items-center gap-1 text-[12px] text-danger" role="alert">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </span>
      ) : null}
    </span>
  );
}
