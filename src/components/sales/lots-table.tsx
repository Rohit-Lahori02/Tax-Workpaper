"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Badge, cn } from "@/components/ui";
import { fmtNumber } from "@/lib/format";
import type { LotRow } from "@/lib/packet/sales";
import { documentHref, lineHref } from "@/lib/refs";

const ROW = 36;

export function LotsTable({ rows, docTitles, version }: { rows: LotRow[]; docTitles: Record<string, string>; version: string }) {
  "use no memo"; // TanStack Virtual returns functions the React Compiler cannot memoize safely.
  const [box, setBox] = useState("all");
  const [doc, setDoc] = useState("all");
  const [q, setQ] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);

  const boxes = useMemo(() => [...new Set(rows.map((r) => r.box))].sort(), [rows]);
  const docs = useMemo(() => [...new Set(rows.map((r) => r.docId).filter((d): d is string => Boolean(d)))].sort(), [rows]);
  const shown = useMemo(
    () =>
      rows.filter((r) => {
        if (box !== "all" && r.box !== box) return false;
        if (doc !== "all" && r.docId !== doc) return false;
        if (q && !(r.description + " " + r.key + " " + (r.sold ?? "")).toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [rows, box, doc, q],
  );
  const totals = useMemo(
    () =>
      shown.reduce(
        (a, r) => ({ proceeds: a.proceeds + (r.proceeds ?? 0), basis: a.basis + (r.basis ?? 0), adjustment: a.adjustment + r.adjustment, gain: a.gain + r.gain }),
        { proceeds: 0, basis: 0, adjustment: 0, gain: 0 },
      ),
    [shown],
  );

  const virtualizer = useVirtualizer({ count: shown.length, getScrollElement: () => parentRef.current, estimateSize: () => ROW, overscan: 12 });
  const control = "h-8 rounded-full border border-border bg-surface px-3 text-[12px] outline-none focus:border-accent";
  const grid = "grid grid-cols-[56px_minmax(220px,1fr)_100px_100px_110px_110px_90px_110px_120px] items-center gap-x-3 px-4";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <select value={box} onChange={(e) => setBox(e.target.value)} className={control} aria-label="Box" suppressHydrationWarning>
          <option value="all">Every box</option>
          {boxes.map((b) => (
            <option key={b} value={b}>
              Box {b}
            </option>
          ))}
        </select>
        <select value={doc} onChange={(e) => setDoc(e.target.value)} className={control} aria-label="Statement" suppressHydrationWarning>
          <option value="all">Every statement</option>
          {docs.map((d) => (
            <option key={d} value={d}>
              {d} · {docTitles[d] ?? d}
            </option>
          ))}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by security or date" aria-label="Filter lots" suppressHydrationWarning className={cn(control, "w-64")} />
        <span className="ml-auto text-[12px] text-muted">
          {shown.length} of {rows.length} lots
        </span>
      </div>
      <div className={cn(grid, "border-b border-border py-2 text-[11px] font-medium uppercase tracking-[0.05em] text-muted")}>
        <span>Box</span>
        <span>Security</span>
        <span>Acquired</span>
        <span>Sold</span>
        <span className="text-right">Proceeds</span>
        <span className="text-right">Basis</span>
        <span className="text-right">Adj.</span>
        <span className="text-right">Gain</span>
        <span>Source</span>
      </div>
      <div ref={parentRef} className="scroll-thin overflow-auto" style={{ height: Math.min(shown.length, 16) * ROW + 8 }}>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const r = shown[vi.index];
            return (
              <div
                key={r.key}
                className={cn(grid, "absolute left-0 right-0 border-b border-border text-[12.5px] hover:bg-surface-2")}
                style={{ top: vi.start, height: ROW }}
              >
                <span className="font-mono text-[11px] text-muted">{r.box}</span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <Link href={lineHref(r.key, version)} className="truncate hover:underline" title={r.description}>
                    {r.description}
                  </Link>
                  {r.supplemented ? <Badge tone="accent">supp.</Badge> : null}
                  {r.basis === null || r.basis === 0 ? <Badge tone="warn">no basis</Badge> : null}
                </span>
                <span className="font-mono text-[11px] text-muted">{r.acquired ?? "—"}</span>
                <span className="font-mono text-[11px] text-muted">{r.sold ?? "—"}</span>
                <span className="num">{r.proceeds === null ? "—" : fmtNumber(r.proceeds)}</span>
                <span className="num">{r.basis === null ? "—" : fmtNumber(r.basis)}</span>
                <span className="num text-muted">{r.adjustment ? fmtNumber(r.adjustment) : "—"}</span>
                <span className={cn("num font-medium", r.gain < 0 ? "text-danger" : "")}>{fmtNumber(r.gain)}</span>
                <span className="truncate font-mono text-[11px]">
                  {r.docId ? (
                    <Link href={documentHref(r.docId, r.anchorValue ? { value: r.anchorValue } : {})} className="text-accent hover:underline">
                      {r.docId} · {r.lot}
                    </Link>
                  ) : (
                    <span className="text-muted">computed</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className={cn(grid, "border-t border-border py-2 text-[12.5px] font-medium")}>
        <span />
        <span className="text-muted">Shown total</span>
        <span />
        <span />
        <span className="num">{fmtNumber(totals.proceeds)}</span>
        <span className="num">{fmtNumber(totals.basis)}</span>
        <span className="num">{totals.adjustment ? fmtNumber(totals.adjustment) : "—"}</span>
        <span className={cn("num", totals.gain < 0 ? "text-danger" : "")}>{fmtNumber(totals.gain)}</span>
        <span />
      </div>
    </div>
  );
}
