"use client";

import { useState, useTransition } from "react";
import { cn } from "@/components/ui";
import { assignAction } from "@/lib/facts/actions-review";

export function AssignmentForm({
  scope,
  role,
  assigneeId,
  due,
  staff,
  allowed,
}: {
  scope: string;
  role: string;
  assigneeId: string;
  due: string | null;
  staff: { id: string; name: string; role: string }[];
  allowed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const current = staff.find((s) => s.id === assigneeId);
  if (!open) {
    return (
      <div className="text-[12.5px]">
        <div>{current?.name ?? assigneeId ?? <span className="text-muted">unassigned</span>}</div>
        <div className="text-[11px] text-muted">
          {due ? "due " + due : "no due date"}
          {allowed ? (
            <>
              {" · "}
              <button type="button" onClick={() => setOpen(true)} className="text-accent hover:underline">
                change
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  }
  const eligible = role === "partner" ? staff.filter((s) => s.role === "partner") : staff;
  return (
    <form
      className="grid gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setError(null);
          const r = await assignAction(fd);
          if (r.ok) setOpen(false);
          else setError(r.error);
        });
      }}
    >
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="role" value={role} />
      <select name="assigneeId" defaultValue={assigneeId} className="h-7 rounded-md border border-border bg-surface px-2 text-[12px]">
        {eligible.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · {s.role.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <input type="date" name="due" defaultValue={due ?? ""} className="h-7 rounded-md border border-border bg-surface px-2 text-[12px]" />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={cn("rounded-full bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-fg", pending && "opacity-50")}>
          Save
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-muted hover:text-foreground">
          Cancel
        </button>
        {error ? <span className="text-[11px] text-danger">{error}</span> : null}
      </div>
    </form>
  );
}
