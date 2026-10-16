"use client";

import { CheckCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { markSeenAction } from "@/lib/facts/actions-adjust";

export function MarkSeenButton({ disabled }: { disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() =>
          start(async () => {
            const r = await markSeenAction();
            setError(r.ok ? null : r.error);
          })
        }
        className="pill primary disabled:opacity-50"
      >
        <CheckCheck className="h-3.5 w-3.5" /> I have looked at all of this
      </button>
      {error ? <span className="text-[12px] text-danger">{error}</span> : null}
    </span>
  );
}
