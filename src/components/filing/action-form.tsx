"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { cn } from "@/components/ui";
import type { ActionResult } from "@/lib/facts/actions";

export interface ActionField {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea";
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  hint?: string;
}

/**
 * One server action as a small form: hidden values, optional visible fields,
 * a button, and the error if the server refuses. Pages stay server-rendered;
 * only this island runs in the browser.
 */
export function ActionForm({
  action,
  hidden = {},
  fields = [],
  label,
  icon,
  primary,
  danger,
  confirm,
  disabled,
  disabledReason,
  className,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  hidden?: Record<string, string>;
  fields?: ActionField[];
  label: string;
  icon?: ReactNode;
  primary?: boolean;
  danger?: boolean;
  confirm?: string;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(fields.length === 0);
  const [done, setDone] = useState(false);
  const input = "input text-foreground";
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 2500);
    return () => clearTimeout(t);
  }, [done]);

  if (disabled) {
    return (
      <span className="text-[12px] text-muted" title={disabledReason}>
        {disabledReason ?? label + " is not available."}
      </span>
    );
  }

  return (
    <form
      className={cn("grid gap-2", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        for (const [k, v] of Object.entries(hidden)) fd.set(k, v);
        start(async () => {
          setError(null);
          const r = await action(fd);
          if (!r.ok) setError(r.error);
          else {
            setDone(true);
            if (fields.length) setOpen(false);
          }
        });
      }}
    >
      {open && fields.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {fields.map((f) => (
            <label key={f.name} className={cn("grid gap-1 text-[12px] text-muted", f.type === "textarea" && "sm:col-span-2")}>
              {f.label}
              {f.type === "textarea" ? (
                <textarea name={f.name} rows={2} placeholder={f.placeholder} defaultValue={f.defaultValue} required={f.required} className={input} suppressHydrationWarning />
              ) : (
                <input name={f.name} type={f.type === "number" ? "text" : "text"} inputMode={f.type === "number" ? "decimal" : undefined} placeholder={f.placeholder} defaultValue={f.defaultValue} required={f.required} className={input} suppressHydrationWarning />
              )}
              {f.hint ? <span className="text-[11px]">{f.hint}</span> : null}
            </label>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={cn("pill h-8", primary && "primary", danger && "border-danger/40 text-danger", pending && "opacity-50")}>
          {icon}
          {pending ? "Working…" : label}
        </button>
        {open && fields.length ? (
          <button type="button" onClick={() => setOpen(false)} className="pill h-8">
            Cancel
          </button>
        ) : null}
        {error ? (
          <span className="flex items-center gap-1 text-[12px] text-danger" role="alert">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </span>
        ) : done ? (
          <span className="flex items-center gap-1 text-[12px] text-ok" role="status">
            <CheckCircle2 className="h-3.5 w-3.5" /> Recorded
          </span>
        ) : null}
      </div>
    </form>
  );
}
