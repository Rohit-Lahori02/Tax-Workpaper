"use client";

import { useMemo, useState } from "react";
import { RefLink } from "@/components/ref-link";
import { Badge, cn, type Tone } from "@/components/ui";
import { KIND_LABELS, type FactKind, type FactView } from "@/lib/facts/types";
import { ROLE_LABELS } from "@/lib/roles";

const fmtWhen = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

const TONE: Record<string, Tone> = {
  verification: "ok",
  note: "neutral",
  question: "accent",
  answer: "accent",
  attachment: "neutral",
  retract: "warn",
  resolve: "ok",
  sensitive_view: "warn",
};

function summaryOf(f: FactView): string {
  const b = f.body;
  switch (f.kind) {
    case "verification":
      return String(b.type ?? "").replace(/_/g, " ") + (b.note ? " · " + String(b.note) : "");
    case "note":
      return (b.blocking ? "[blocks filing] " : "") + String(b.text ?? "");
    case "question":
      return "to " + (b.to === "client" ? "the client" : String(b.to)) + ": " + String(b.text ?? "");
    case "answer":
      return (b.onBehalf ? "(recorded for the client) " : "") + String(b.text ?? "");
    case "attachment":
      return String(b.name ?? "file");
    case "retract":
      return "retracted an earlier record" + (b.reason ? ": " + String(b.reason) : "");
    case "resolve":
      return "resolved a note" + (b.text ? ": " + String(b.text) : "");
    case "sensitive_view":
      return "viewed unmasked: " + (Array.isArray(b.fields) ? (b.fields as string[]).join(", ") : "");
    default:
      return JSON.stringify(b);
  }
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
    if (q && !(r.target + " " + summaryOf(r)).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const control = "h-8 rounded-full border border-border bg-surface px-3 text-[12px] outline-none focus:border-accent";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={control} aria-label="Kind" suppressHydrationWarning>
          <option value="all">All kinds</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k as FactKind] ?? k}
            </option>
          ))}
        </select>
        <select value={actor} onChange={(e) => setActor(e.target.value)} className={control} aria-label="Person" suppressHydrationWarning>
          <option value="all">Everyone</option>
          {actors.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by target or text"
          aria-label="Filter activity"
          suppressHydrationWarning
          className={cn(control, "ml-auto w-64")}
        />
      </div>
      <div className="overflow-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>What</th>
              <th>On</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <tr key={f.id} className={cn(f.retracted && "opacity-60")}>
                <td className="whitespace-nowrap text-muted">{fmtWhen.format(new Date(f.at))}</td>
                <td className="whitespace-nowrap">
                  <div className="font-medium">{f.actorName}</div>
                  <div className="text-[11px] text-muted">{f.actorRole === "unknown" ? "" : ROLE_LABELS[f.actorRole]}</div>
                </td>
                <td>
                  <Badge tone={TONE[f.kind] ?? "neutral"}>{KIND_LABELS[f.kind as FactKind] ?? f.kind}</Badge>
                  {f.retracted ? (
                    <Badge tone="neutral" className="ml-1">
                      retracted
                    </Badge>
                  ) : null}
                </td>
                <td className="whitespace-nowrap">
                  {f.target.startsWith("/") ? <span className="font-mono text-[12px] text-muted">{f.target}</span> : <RefLink refId={f.target} />}
                </td>
                <td className="max-w-2xl">
                  <span className="line-clamp-2">{summaryOf(f)}</span>
                </td>
              </tr>
            ))}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted">
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
