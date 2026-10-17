"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "@/components/ui";
import { setRevealAction } from "@/lib/facts/actions";

/** Cleared staff can unmask sensitive data for the session. Every page that shows it unmasked is logged. */
export function RevealToggle({ eligible, on }: { eligible: boolean; on: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!eligible) {
    return (
      <span className="hidden h-8 items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 text-[12px] text-muted sm:inline-flex" title="Your role has no sensitive-data clearance; identifiers stay masked.">
        <EyeOff className="h-3.5 w-3.5" /> masked
      </span>
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
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors",
        on ? "border-warn/40 bg-warn-soft text-warn" : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground",
        pending && "opacity-60",
      )}
    >
      {on ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{on ? "Unmasked · logged" : "Masked"}</span>
    </button>
  );
}
