"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, cn, type Tone } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import type { DocumentRow, DocumentState } from "@/lib/packet/documents";
import { documentHref } from "@/lib/refs";
import { typeIcon } from "./type-icon";

const STATE_LABEL: Record<DocumentState, { label: string; tone: Tone }> = {
  reached: { label: "On the return", tone: "ok" },
  unused: { label: "Reaches no line", tone: "warn" },
  superseded: { label: "Superseded", tone: "neutral" },
  not_extracted: { label: "Not extracted", tone: "danger" },
};

type Filter = "all" | DocumentState | "attention";


function ExtractionDot({ status }: { status: DocumentRow["extraction"] }) {
  const tone = status === "extracted" ? "bg-ok" : status === "partial" ? "bg-warn" : "bg-danger";
  return (
    <span className="inline-flex items-center gap-1.5 capitalize">
      <span className={cn("h-1.5 w-1.5 rounded-full", tone)} />
      {status.replace("_", " ")}
    </span>
  );
}

export function DocumentTable({ rows, version }: { rows: DocumentRow[]; version: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [owner, setOwner] = useState("all");

  const owners = useMemo(() => [...new Set(rows.map((r) => r.belongsTo))].sort(), [rows]);
  const counts = useMemo(() => {
    const c: Record<DocumentState, number> = { reached: 0, unused: 0, superseded: 0, not_extracted: 0 };
    for (const r of rows) c[r.state] += 1;
    return c;
  }, [rows]);
  const attention = rows.filter((r) => r.state === "unused" || r.state === "not_extracted" || r.extraction === "partial").length;

  const shown = rows.filter((r) => {
    if (owner !== "all" && r.belongsTo !== owner) return false;
    if (filter === "attention" && !(r.state === "unused" || r.state === "not_extracted" || r.extraction === "partial")) return false;
    if (filter !== "all" && filter !== "attention" && r.state !== filter) return false;
    if (q) {
      const s = (r.id + " " + r.title + " " + r.issuer + " " + r.type).toLowerCase();
      if (!s.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const seg: { key: Filter; label: string; n: number; tone?: Tone }[] = [
    { key: "all", label: "All", n: rows.length },
    { key: "attention", label: "Needs attention", n: attention, tone: "warn" },
  ];
  const chips: { key: Filter; label: string; n: number; tone: Tone }[] = [
    { key: "reached", label: "On the return", n: counts.reached, tone: "ok" },
    { key: "unused", label: "Reaches no line", n: counts.unused, tone: "warn" },
    { key: "not_extracted", label: "Not extracted", n: counts.not_extracted, tone: "danger" },
    { key: "superseded", label: "Superseded", n: counts.superseded, tone: "neutral" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="seg">
          {seg.map((c) => (
            <button key={c.key} type="button" onClick={() => setFilter(c.key)} className={cn("seg-item", filter === c.key && "is-active")}>
              {c.label}
              <span className={cn("font-mono text-[10.5px]", c.tone === "warn" && c.n ? "text-warn" : "text-muted")}>{c.n}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button key={c.key} type="button" onClick={() => setFilter(filter === c.key ? "all" : c.key)} className={cn("chip", filter === c.key && "is-active")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", c.tone === "ok" ? "bg-ok" : c.tone === "warn" ? "bg-warn" : c.tone === "danger" ? "bg-danger" : "bg-border-strong")} />
              {c.label}
              <span className="count">{c.n}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 xl:ml-auto">
          <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Belongs to" suppressHydrationWarning className="input h-8 w-auto py-0 pr-7 text-[12px]">
            <option value="all">Everyone</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter documents" aria-label="Filter documents" suppressHydrationWarning className="input h-8 w-52 py-0 pl-8 text-[12px]" />
          </div>
        </div>
      </div>
      <div className="overflow-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th className="w-10"></th>
              <th>Document</th>
              <th>Belongs to</th>
              <th>Received</th>
              <th>Extraction</th>
              <th className="num">Values</th>
              <th className="num">Lines in {version}</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const st = STATE_LABEL[r.state];
              const Icon = typeIcon(r.type);
              const later = r.reason?.startsWith("Not yet received");
              return (
                <tr key={r.id} className={cn(later && "opacity-50")}>
                  <td className="pl-4 pr-0">
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-inset", r.state === "not_extracted" ? "bg-danger-soft text-danger ring-danger/20" : r.state === "unused" ? "bg-warn-soft text-warn ring-warn/25" : "bg-surface-2 text-muted ring-border")}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>
                  </td>
                  <td className="min-w-[260px] max-w-md">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link href={documentHref(r.id)} className="ref">
                        {r.id}
                      </Link>
                      <Link href={documentHref(r.id)} className="font-medium hover:text-accent">
                        {r.title}
                      </Link>
                      {r.corrected ? <Badge tone="warn">corrected</Badge> : null}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-muted">
                      {r.issuer} · {r.type} · {r.pageCount} {r.pageCount === 1 ? "page" : "pages"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{r.belongsTo}</span>
                  </td>
                  <td className="whitespace-nowrap text-muted">
                    <div className="tabular-nums text-foreground/90">{fmtDate(r.receivedAt)}</div>
                    <div className="text-[11px]">from the {r.uploadedBy}</div>
                  </td>
                  <td className="max-w-[220px]">
                    <ExtractionDot status={r.extraction} />
                    {r.reason ? <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted">{r.reason}</div> : null}
                  </td>
                  <td className="num">{r.values || <span className="text-border-strong">—</span>}</td>
                  <td className="num">{r.linesReached || <span className="text-border-strong">—</span>}</td>
                  <td>
                    <Badge tone={st.tone} dot>
                      {st.label}
                    </Badge>
                    {r.state === "superseded" && r.replacedBy ? (
                      <div className="mt-1 text-[11px] text-muted">
                        by{" "}
                        <Link href={documentHref(r.replacedBy)} className="font-mono text-accent hover:underline">
                          {r.replacedBy}
                        </Link>
                      </div>
                    ) : null}
                    {r.state === "unused" && r.usedIn.length ? <div className="mt-1 text-[11px] text-muted">listed as used in {r.usedIn.join(", ")}</div> : null}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-muted">
                  No documents match.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={8} className="border-t border-border px-5 py-2 text-[11.5px] text-muted">
                {shown.length} of {rows.length} documents · click a document to read its page with every extracted value highlighted
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
