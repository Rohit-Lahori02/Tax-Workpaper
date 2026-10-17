"use client";

import { AlertTriangle } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge, cn } from "@/components/ui";
import { dispositionAction } from "@/lib/facts/actions-judgment";
import { DISPOSITION_LABELS, DISPOSITIONS, type Disposition } from "@/lib/facts/types";

export function DispositionForm({
  docId,
  current,
  allowed,
}: {
  docId: string;
  current: { disposition: Disposition; text?: string; actorName: string } | null;
  allowed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {current ? (
          <>
            <Badge tone={current.disposition === "pending" ? "warn" : "ok"} dot>
              {DISPOSITION_LABELS[current.disposition]}
            </Badge>
            {current.text ? <span className="text-[12px] text-muted">{current.text}</span> : null}
            <span className="text-[11px] text-muted">by {current.actorName}</span>
          </>
        ) : (
          <Badge tone="warn" dot>
            no disposition
          </Badge>
        )}
        {allowed ? (
          <button type="button" onClick={() => setOpen(true)} className={cn(current ? "text-[12px] text-accent hover:underline" : "pill h-7 px-2.5 text-[12px]")}>
            {current ? "Change" : "Account for it"}
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setError(null);
          const r = await dispositionAction(fd);
          if (r.ok) setOpen(false);
          else setError(r.error);
        });
      }}
    >
      <input type="hidden" name="target" value={docId} />
      <select name="disposition" defaultValue={current?.disposition ?? "reference_only"} className="input h-8 w-auto py-0 text-[12px]">
        {DISPOSITIONS.map((d) => (
          <option key={d} value={d}>
            {DISPOSITION_LABELS[d]}
          </option>
        ))}
      </select>
      <input name="text" placeholder="Why (optional)" className="input h-8 w-full py-0 text-[12px] sm:w-56" />
      <button type="submit" disabled={pending} className={cn("pill primary h-8", pending && "opacity-50")}>
        {pending ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="pill h-8">
        Cancel
      </button>
      {error ? (
        <span className="flex items-center gap-1 text-[12px] text-danger" role="alert">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </span>
      ) : null}
    </form>
  );
}
