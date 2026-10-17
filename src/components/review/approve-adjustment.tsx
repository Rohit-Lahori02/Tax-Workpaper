"use client";

import { ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "@/components/ui";
import { approveAdjustmentAction } from "@/lib/facts/actions-review";

export function ApproveAdjustmentButton({ factId, allowed, label = "Approve as partner" }: { factId: string; allowed: boolean; label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!allowed) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const fd = new FormData();
          fd.set("factId", factId);
          start(async () => {
            const r = await approveAdjustmentAction(fd);
            setError(r.ok ? null : r.error);
          });
        }}
        className={cn("pill primary h-7 px-2.5 text-[12px]", pending && "opacity-50")}
      >
        <ShieldCheck className="h-3 w-3" /> {label}
      </button>
      {error ? <span className="text-[11px] text-danger">{error}</span> : null}
    </span>
  );
}
