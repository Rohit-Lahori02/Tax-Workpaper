"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, cn, type Tone } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import type { DocumentRow, DocumentState } from "@/lib/packet/documents";
import { documentHref } from "@/lib/refs";

const STATE_LABEL: Record<DocumentState, { label: string; tone: Tone }> = {
  reached: { label: "On the return", tone: "ok" },
  unused: { label: "Reaches no line", tone: "warn" },
  superseded: { label: "Superseded", tone: "neutral" },
  not_extracted: { label: "Not extracted", tone: "danger" },
};

type Filter = "all" | DocumentState | "attention";

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

  const chips: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "All", n: rows.length },
    { key: "reached", label: "On the return", n: counts.reached },
    { key: "unused", label: "Reaches no line", n: counts.unused },
    { key: "superseded", label: "Superseded", n: counts.superseded },
    { key: "not_extracted", label: "Not extracted", n: counts.not_extracted },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={cn(
                "rounded-md px-2 py-1 text-[12px] font-medium",
                filter === c.key ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-foreground",
              )}
            >
              {c.label} <span className="font-mono opacity-70">{c.n}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            aria-label="Belongs to"
            className="h-8 rounded-md border border-border bg-surface px-2 text-[12px]"
          >
            <option value="all">Everyone</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by id, title, issuer, type"
            aria-label="Filter documents"
            className="h-8 w-64 rounded-md border border-border bg-surface px-2.5 text-[12px] outline-none focus:border-accent"
          />
        </div>
      </div>
      <div className="overflow-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Id</th>
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
              return (
                <tr key={r.id}>
                  <td>
                    <Link href={documentHref(r.id)} className="font-mono text-[12px] text-accent hover:underline">
                      {r.id}
                    </Link>
                  </td>
                  <td className="max-w-md">
                    <Link href={documentHref(r.id)} className="font-medium hover:underline">
                      {r.title}
                    </Link>
                    <div className="text-xs text-muted">
                      {r.issuer} · {r.type} · {r.pageCount} {r.pageCount === 1 ? "page" : "pages"}
                      {r.corrected ? (
                        <Badge tone="warn" className="ml-1.5">
                          CORRECTED
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-muted">{r.belongsTo}</td>
                  <td className="whitespace-nowrap text-muted">
                    {fmtDate(r.receivedAt)}
                    <div className="text-[11px]">from {r.uploadedBy}</div>
                  </td>
                  <td className="max-w-xs">
                    <span className={cn("capitalize", r.extraction !== "extracted" && "text-warn")}>{r.extraction.replace("_", " ")}</span>
                    {r.reason ? <div className="text-[11px] text-muted">{r.reason}</div> : null}
                  </td>
                  <td className="num">{r.values || "—"}</td>
                  <td className="num">{r.linesReached || "—"}</td>
                  <td>
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {r.state === "superseded" && r.replacedBy ? (
                      <div className="mt-0.5 text-[11px] text-muted">
                        by{" "}
                        <Link href={documentHref(r.replacedBy)} className="font-mono text-accent hover:underline">
                          {r.replacedBy}
                        </Link>
                      </div>
                    ) : null}
                    {r.state === "unused" && r.usedIn.length ? (
                      <div className="mt-0.5 text-[11px] text-muted">listed as used in {r.usedIn.join(", ")}</div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted">
                  No documents match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
