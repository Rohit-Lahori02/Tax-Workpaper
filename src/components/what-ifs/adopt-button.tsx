"use client";

import { FlaskConical, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { adoptWhatIfAction, undoBatchAction } from "@/lib/facts/actions-adjust";

export function AdoptButton({ id, adoptedBatch, allowed }: { id: string; adoptedBatch: string | null; allowed: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!allowed) return null;
  const run = (action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fd: FormData) =>
    start(async () => {
      setError(null);
      const r = await action(fd);
      if (!r.ok) setError(r.error ?? "Failed");
    });
  return (
    <div className="flex items-center gap-2">
      {adoptedBatch ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const fd = new FormData();
            fd.set("batchId", adoptedBatch);
            run(undoBatchAction, fd);
          }}
          className="pill"
        >
          <Undo2 className="h-3.5 w-3.5" /> Undo adoption
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const fd = new FormData();
            fd.set("id", id);
            run(adoptWhatIfAction, fd);
          }}
          className="pill primary"
        >
          <FlaskConical className="h-3.5 w-3.5" /> Adopt as adjustments
        </button>
      )}
      {error ? <span className="text-[12px] text-danger">{error}</span> : null}
    </div>
  );
}
