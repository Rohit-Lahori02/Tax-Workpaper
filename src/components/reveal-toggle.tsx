"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge, cn } from "@/components/ui";
import { setRevealAction } from "@/lib/facts/actions";

/** Cleared staff can unmask sensitive data for the session. Every page that shows it unmasked is logged. */
export function RevealToggle({ eligible, on }: { eligible: boolean; on: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!eligible) {
    return (
      <Badge tone="warn" className="hidden sm:inline-flex">
        <EyeOff className="h-3 w-3" /> sensitive data masked
      </Badge>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      title={error ?? (on ? "Sensitive data is unmasked for this session. Views are logged." : "Sensitive data is masked. Unmask for this session (logged).")}
      onClick={() =>
        start(async () => {
          const r = await setRevealAction(!on);
          setError(r.ok ? null : r.error);
        })
      }
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium",
        on ? "border-warn/40 bg-warn-soft text-warn" : "border-border bg-surface text-muted hover:text-foreground",
        pending && "opacity-60",
      )}
    >
      {on ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      {on ? "Unmasked · logged" : "Masked"}
    </button>
  );
}
