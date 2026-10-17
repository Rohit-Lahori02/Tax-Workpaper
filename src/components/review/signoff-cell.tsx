"use client";

import { CheckCircle2, PenLine, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge, cn } from "@/components/ui";
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

  return (
    <div className="grid gap-1">
      {cell.state === "valid" ? (
        <div className="text-[12px]">
          <Badge tone="ok">
            <CheckCircle2 className="h-3 w-3" /> signed
          </Badge>
          <div className="mt-0.5 text-muted">
            {cell.signer} · {cell.at ? fmtWhen.format(new Date(cell.at)) : ""}
          </div>
          <div className="font-mono text-[10px] text-muted">{cell.hash?.slice(0, 12)}</div>
        </div>
      ) : null}
      {cell.state === "reopened" ? (
        <div className="text-[12px]">
          <Badge tone="warn">
            <RotateCcw className="h-3 w-3" /> reopened
          </Badge>
          <div className="mt-0.5 text-muted">
            {cell.signer} signed {cell.at ? fmtWhen.format(new Date(cell.at)) : ""}; since then {cell.changes.facts} new record{cell.changes.facts === 1 ? "" : "s"}
            {cell.changes.lines.length ? ", " + cell.changes.lines.length + " line" + (cell.changes.lines.length === 1 ? "" : "s") + " changed" : ""}.
          </div>
        </div>
      ) : null}
      {cell.state === "missing" ? <span className="text-[12px] text-muted">not signed</span> : null}

      {cell.state !== "valid" ? (
        cell.allowed ? (
          open ? (
            <div className="grid gap-1">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-7 rounded-md border border-border bg-surface px-2 text-[12px] outline-none focus:border-accent" />
              <div className="flex gap-1">
                <button type="button" disabled={pending} onClick={sign} className={cn("inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-fg", pending && "opacity-50")}>
                  <PenLine className="h-3 w-3" /> {cell.state === "reopened" ? "Re-sign" : "Sign as " + cell.level}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-muted hover:text-foreground">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setOpen(true)} className="pill h-7 w-fit px-2.5 text-[12px]">
              <PenLine className="h-3 w-3" /> {cell.state === "reopened" ? "Re-sign" : "Sign off"}
            </button>
          )
        ) : cell.reason ? (
          <span className="text-[11px] text-muted" title={cell.reason}>
            {cell.reason}
          </span>
        ) : null
      ) : null}
      {error ? <span className="text-[11px] text-danger">{error}</span> : null}
    </div>
  );
}
