"use client";

import { Search } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { RefLink } from "@/components/ref-link";
import { Badge, cn, type Tone } from "@/components/ui";
import { factSummary, targetLabel } from "@/lib/facts/summary";
import { KIND_LABELS, type FactKind, type FactView } from "@/lib/facts/types";
import { ROLE_LABELS } from "@/lib/roles";

const fmtDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fmtTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

const TONE: Record<string, Tone> = {
  verification: "ok",
  note: "neutral",
  question: "accent",
  answer: "accent",
  attachment: "neutral",
  retract: "warn",
  resolve: "ok",
  sensitive_view: "warn",
  adjustment: "accent",
  judgment: "ok",
  disposition: "neutral",
  step: "neutral",
  signoff: "ok",
  assignment: "neutral",
  approval_request: "accent",
  approval: "ok",
  filing: "danger",
  correction: "warn",
  standard: "accent",
  time: "neutral",
  seen: "neutral",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function ActivityTable({ rows }: { rows: FactView[] }) {
  const [kind, setKind] = useState<string>("all");
  const [actor, setActor] = useState<string>("all");
  const [q, setQ] = useState("");

  const actors = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.actorId, r.actorName);
    return [...m.entries()];
  }, [rows]);
  const kinds = useMemo(() => [...new Set(rows.map((r) => r.kind))], [rows]);

  const shown = rows.filter((r) => {
    if (kind !== "all" && r.kind !== kind) return false;
    if (actor !== "all" && r.actorId !== actor) return false;
    if (q && !(r.target + " " + factSummary(r) + " " + r.actorName).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  // Day separators keep a long feed readable.
  const withDays: { day: string; items: FactView[] }[] = [];
  for (const f of shown) {
    const day = fmtDay.format(new Date(f.at));
    const g = withDays.at(-1);
    if (g && g.day === day) g.items.push(f);
    else withDays.push({ day, items: [f] });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="input h-8 w-auto py-0 text-[12px]" aria-label="Kind" suppressHydrationWarning>
          <option value="all">All kinds</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k as FactKind] ?? k}
            </option>
          ))}
        </select>
        <select value={actor} onChange={(e) => setActor(e.target.value)} className="input h-8 w-auto py-0 text-[12px]" aria-label="Person" suppressHydrationWarning>
          <option value="all">Everyone</option>
          {actors.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <div className="relative w-full sm:ml-auto sm:w-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by target, person or text" aria-label="Filter activity" suppressHydrationWarning className="input h-8 w-full py-0 pl-8 text-[12px] sm:w-72" />
        </div>
        <span className="text-[12px] text-muted">
          <span className="font-medium tabular-nums text-foreground">{shown.length}</span> of {rows.length}
        </span>
      </div>
      <div className="overflow-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th className="w-20">When</th>
              <th>Who</th>
              <th>What</th>
              <th>On</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {withDays.map((g) => (
              <Fragment key={g.day}>
                <tr>
                  <td colSpan={5} className="bg-surface-2/50 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                    {g.day}
                  </td>
                </tr>
                {g.items.map((f) => {
                  const tl = targetLabel(f.target);
                  return (
                    <tr key={f.id} className={cn(f.retracted && "opacity-60")}>
                      <td className="whitespace-nowrap font-mono text-[11px] tabular-nums text-muted">{fmtTime.format(new Date(f.at))}</td>
                      <td className="whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <span className={cn("flex h-6 w-6 items-center justify-center rounded-md text-[9.5px] font-semibold", f.actorRole === "client" ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent")}>{initials(f.actorName)}</span>
                          <span className="leading-tight">
                            <span className="block font-medium">{f.actorName}</span>
                            <span className="block text-[10.5px] text-muted">{f.actorRole === "unknown" ? "" : ROLE_LABELS[f.actorRole]}</span>
                          </span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        <Badge tone={TONE[f.kind] ?? "neutral"} dot>
                          {KIND_LABELS[f.kind as FactKind] ?? f.kind}
                        </Badge>
                        {f.retracted ? (
                          <Badge tone="neutral" className="ml-1">
                            retracted
                          </Badge>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap">{tl ? <span className="text-[12.5px]">{tl.label}</span> : <RefLink refId={f.target} />}</td>
                      <td className="max-w-2xl">
                        <span className={cn("line-clamp-2 text-[12.5px] leading-5", f.retracted && "line-through")}>{factSummary(f)}</span>
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-muted">
                  Nothing recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
