"use client";

import { CheckCircle2, Lock, PenLine, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "@/components/ui";
import { signoffAction } from "@/lib/facts/actions-review";

const fmtWhen = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });

export interface SignoffCellData {
  scope: string;
  level: string;
  state: "missing" | "valid" | "reopened";
  signer: string | null;
  at: string | null;
  hash: string | null;
  changes: { facts: number; lines: string[] };
  allowed: boolean;
  reason: string | null;
}

/**
 * One cell of the sign-off matrix. Quiet when there is nothing to do: a dash
 * with the reason on hover. Loud only when the viewer can act or something
 * reopened.
 */
export function SignoffCell({ cell }: { cell: SignoffCellData }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  const sign = () => {
    const fd = new FormData();
    fd.set("scope", cell.scope);
    fd.set("level", cell.level);
    if (note) fd.set("text", note);
    start(async () => {
      setError(null);
      const r = await signoffAction(fd);
      if (r.ok) {
        setOpen(false);
        setNote("");
      } else setError(r.error);
    });
  };

  if (cell.state === "valid") {
    return (
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok ring-1 ring-inset ring-ok/20">
          <CheckCircle2 className="h-3 w-3" />
        </span>
        <div className="min-w-0 text-[12px] leading-4">
          <div className="font-medium">{cell.signer}</div>
          <div className="text-muted">{cell.at ? fmtWhen.format(new Date(cell.at)) : ""}</div>
          <div className="font-mono text-[10px] text-muted/80" title={cell.hash ?? undefined}>
            {cell.hash?.slice(0, 10)}
          </div>
        </div>
      </div>
    );
  }

  const action =
    cell.allowed ? (
      open ? (
        <div className="mt-1.5 grid gap-1.5">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="input h-7 py-0 text-[12px]" />
          <div className="flex items-center gap-2">
            <button type="button" disabled={pending} onClick={sign} className={cn("pill primary h-7 px-2.5 text-[12px]", pending && "opacity-50")}>
              <PenLine className="h-3 w-3" /> {cell.state === "reopened" ? "Re-sign" : "Sign as " + cell.level}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-[11.5px] text-muted hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={cn("pill h-7 w-fit px-2.5 text-[12px]", cell.state === "missing" && "mt-0")}>
          <PenLine className="h-3 w-3" /> {cell.state === "reopened" ? "Re-sign" : "Sign off"}
        </button>
      )
    ) : null;

  if (cell.state === "reopened") {
    return (
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn ring-1 ring-inset ring-warn/25">
          <RotateCcw className="h-3 w-3" />
        </span>
        <div className="min-w-0 text-[12px] leading-4">
          <div className="font-medium text-warn">Reopened</div>
          <div className="text-muted">
            {cell.signer} signed {cell.at ? fmtWhen.format(new Date(cell.at)) : ""}
          </div>
          <div className="text-muted">
            since then {cell.changes.facts} new record{cell.changes.facts === 1 ? "" : "s"}
            {cell.changes.lines.length ? ", " + cell.changes.lines.length + " line" + (cell.changes.lines.length === 1 ? "" : "s") + " changed" : ""}
          </div>
          {action}
          {error ? <div className="text-[11px] text-danger">{error}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2" title={cell.reason ?? undefined}>
      {cell.allowed ? (
        <div className="grid gap-1">
          {action}
          {error ? <div className="text-[11px] text-danger">{error}</div> : null}
        </div>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted/70">
          <Lock className="h-3 w-3" /> not signed
        </span>
      )}
    </div>
  );
}
