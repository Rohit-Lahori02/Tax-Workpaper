"use client";

import { AlertTriangle } from "lucide-react";
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
      <div className="flex items-start gap-2 text-[12.5px]">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-[9.5px] font-semibold text-muted">
          {(current?.name ?? assigneeId ?? "?")
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase() ?? "")
            .join("")}
        </span>
        <span className="min-w-0">
          <span className="block font-medium">{current?.name ?? assigneeId ?? <span className="text-muted">unassigned</span>}</span>
          <span className="block text-[11px] text-muted">
            {due ? "due " + due : "no due date"}
            {allowed ? (
              <>
                {" · "}
                <button type="button" onClick={() => setOpen(true)} className="text-accent hover:underline">
                  change
                </button>
              </>
            ) : null}
          </span>
        </span>
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
      <label className="grid gap-1 text-[11px] text-muted">
        Assign to
        <select name="assigneeId" defaultValue={assigneeId} className="input h-7 py-0 text-[12px] text-foreground">
        {eligible.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · {s.role.replace(/_/g, " ")}
          </option>
        ))}
        </select>
      </label>
      <label className="grid gap-1 text-[11px] text-muted">
        Due
        <input type="date" name="due" defaultValue={due ?? ""} className="input h-7 py-0 text-[12px] text-foreground" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={cn("pill primary h-7 px-2.5 text-[12px]", pending && "opacity-50")}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="pill h-7 px-2.5 text-[12px]">
          Cancel
        </button>
        {error ? (
          <span className="flex items-center gap-1 text-[11px] text-danger" role="alert">
            <AlertTriangle className="h-3 w-3" /> {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
