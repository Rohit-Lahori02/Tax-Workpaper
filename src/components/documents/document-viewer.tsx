"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, Crosshair, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Marks } from "@/components/facts/fact-marks";
import { FactsPanel, type StaffOption } from "@/components/facts/facts-panel";
import { Badge, cn, Empty, KV, SectionTitle } from "@/components/ui";
import type { FactView, TargetSummary } from "@/lib/facts/types";
import { fmtPct } from "@/lib/format";
import type { Segment } from "@/lib/packet/pagemarks";
import type { ActorLite } from "@/lib/permissions";
import { lineHref } from "@/lib/refs";

export interface ViewerValue {
  id: string;
  page: number;
  field: string;
  label: string;
  display: string;
  textAsRead: string;
  valueType: string;
  confidence: number;
  position: { x0: number; y0: number; x1: number; y1: number };
  /** False when the text as read could not be found on the printed page. */
  located: boolean;
  landsOn: { key: string; label: string }[];
}

export interface ViewerPage {
  page: number;
  segments: Segment[];
}

export interface ViewerData {
  docId: string;
  title?: string;
  pageCount: number;
  pages: ViewerPage[];
  values: ViewerValue[];
  version: string;
}

export interface ViewerFactsContext {
  actor: ActorLite;
  staff: StaffOption[];
  verificationTypes: string[];
}

const LOW_CONFIDENCE = 0.8;

function ConfidenceBar({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={"Read confidence " + fmtPct(value)}>
      <span className="h-1 w-8 overflow-hidden rounded-full bg-surface-3">
        <span className={cn("block h-full rounded-full", value < 0.6 ? "bg-danger" : value < LOW_CONFIDENCE ? "bg-warn" : "bg-ok")} style={{ width: Math.round(value * 100) + "%" }} />
      </span>
      <span className={cn("font-mono text-[10.5px] tabular-nums", value < LOW_CONFIDENCE ? "text-warn" : "text-muted")}>{fmtPct(value)}</span>
    </span>
  );
}

export function DocumentViewer({
  data,
  initialPage,
  initialValue,
  facts,
  summaries,
  ctx,
}: {
  data: ViewerData;
  initialPage: number;
  initialValue: string | null;
  facts: Record<string, FactView[]>;
  summaries: Record<string, TargetSummary>;
  ctx: ViewerFactsContext;
}) {
  const [page, setPage] = useState(initialPage);
  const [selected, setSelected] = useState<string | null>(initialValue);
  const [q, setQ] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(data.values.map((v) => [v.id, v])), [data.values]);
  const current = data.pages.find((p) => p.page === page) ?? data.pages[0];
  const sel = selected ? (byId.get(selected) ?? null) : null;

  // Keep the URL in step so the view is shareable, without a server round-trip.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(page));
    if (selected) url.searchParams.set("v", selected);
    else url.searchParams.delete("v");
    window.history.replaceState(window.history.state, "", url);
  }, [page, selected]);

  useEffect(() => {
    if (!selected) return;
    const el = sheetRef.current?.querySelector<HTMLElement>('[data-value="' + selected + '"]');
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selected, page]);

  const select = (id: string) => {
    const v = byId.get(id);
    if (!v) return;
    setSelected(id);
    if (v.page !== page) setPage(v.page);
  };

  const listed = data.values.filter((v) => {
    if (!q) return true;
    const s = (v.id + " " + v.field + " " + v.label + " " + v.display).toLowerCase();
    return s.includes(q.toLowerCase());
  });
  const pagesInList = [...new Set(listed.map((v) => v.page))].sort((a, b) => a - b);
  const onThisPage = data.values.filter((v) => v.page === page);
  const locatedHere = current ? current.segments.filter((s) => s.valueId).length : 0;
  const unusedCount = data.values.filter((v) => v.landsOn.length === 0).length;

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
      {/* Values list */}
      <section className="card flex max-h-[calc(100vh-10rem)] flex-col overflow-hidden">
        <div className="border-b border-border p-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={"Filter " + data.values.length + " values"} aria-label="Filter extracted values" suppressHydrationWarning className="input h-8 py-0 pl-8 text-[12px]" />
          </div>
          <div className="mt-2 flex items-center justify-between px-0.5 text-[11px] text-muted">
            <span>
              {data.values.length} values · {data.pageCount} page{data.pageCount === 1 ? "" : "s"}
            </span>
            {unusedCount ? <span className="text-warn">{unusedCount} reach no line</span> : <span className="text-ok">all reach a line</span>}
          </div>
        </div>
        <div className="scroll-thin flex-1 overflow-auto">
          {data.values.length === 0 ? (
            <div className="p-3">
              <Empty>Nothing was extracted from this document.</Empty>
            </div>
          ) : null}
          {pagesInList.map((p) => (
            <div key={p}>
              <button type="button" onClick={() => setPage(p)} className={cn("sticky top-0 z-[1] flex w-full items-center justify-between border-b border-border bg-surface-2/95 px-3 py-1.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] backdrop-blur", p === page ? "text-foreground" : "text-muted hover:text-foreground")}>
                Page {p}
                <span className="font-mono text-[10px] normal-case tracking-normal">{listed.filter((v) => v.page === p).length}</span>
              </button>
              <ul>
                {listed
                  .filter((v) => v.page === p)
                  .map((v) => {
                    const active = selected === v.id;
                    return (
                      <li key={v.id}>
                        <button type="button" onClick={() => select(v.id)} className={cn("relative flex w-full items-start gap-2 border-b border-border/70 px-3 py-2 text-left transition-colors hover:bg-surface-2/70", active && "bg-accent-soft hover:bg-accent-soft")}>
                          {active ? <span className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-r bg-accent" /> : null}
                          <div className="min-w-0 flex-1">
                            <div className={cn("truncate text-[12.5px]", active ? "font-medium" : "")}>{v.label}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted">
                              <span className="font-mono">{v.id}</span>
                              {!v.located ? (
                                <span className="inline-flex items-center gap-0.5 text-warn" title="Text as read was not found on the printed page">
                                  <AlertTriangle className="h-3 w-3" /> not on page
                                </span>
                              ) : null}
                              {v.landsOn.length === 0 ? (
                                <span className="rounded bg-surface-3 px-1 text-[10px] leading-4" title="No return line cites this value">
                                  unused
                                </span>
                              ) : null}
                              {summaries[v.id] ? <Marks s={summaries[v.id]} /> : null}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-mono text-[12.5px] font-medium tabular-nums">{v.display}</div>
                            <ConfidenceBar value={v.confidence} className="mt-0.5 justify-end" />
                          </div>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* The page */}
      <section className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="seg">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="seg-item px-2 disabled:opacity-40" aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="seg-item is-active cursor-default">
              Page {page} <span className="text-muted">of {data.pageCount}</span>
            </span>
            <button type="button" disabled={page >= data.pageCount} onClick={() => setPage(page + 1)} className="seg-item px-2 disabled:opacity-40" aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-[11.5px] text-muted">
            <Crosshair className="h-3.5 w-3.5" />
            {locatedHere} of {onThisPage.length} values located on this page
            {onThisPage.length - locatedHere > 0 ? <span className="text-warn">· {onThisPage.length - locatedHere} not found as read</span> : null}
          </div>
        </div>
        <div ref={sheetRef} className="card overflow-hidden" style={{ minHeight: "30rem" }}>
          <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2/60 px-6 py-2.5 text-[11px] uppercase tracking-[0.08em] text-muted">
            <span className="flex items-center gap-2">
              <span className="font-mono normal-case tracking-normal text-foreground">{data.docId}</span>
              <span className="hidden truncate normal-case tracking-normal sm:inline">{data.title}</span>
            </span>
            <span className="shrink-0 font-mono normal-case tracking-normal">
              simulated page · {page} / {data.pageCount}
            </span>
          </div>
          <div className="px-6 py-7 sm:px-10 sm:py-9">
            {current ? (
              <p className="mx-auto max-w-[72ch] whitespace-pre-wrap font-mono text-[12.5px] leading-7">
                {current.segments.map((s, i) =>
                  s.valueId ? (
                    <mark key={i} data-value={s.valueId} className={cn("ev", selected === s.valueId && "is-selected")} onClick={() => select(s.valueId!)} title={byId.get(s.valueId)?.label}>
                      {s.text}
                    </mark>
                  ) : (
                    <span key={i}>{s.text}</span>
                  ),
                )}
              </p>
            ) : (
              <Empty>The packet has no text for this page.</Empty>
            )}
          </div>
          <div className="border-t border-dashed border-border px-6 py-2 text-[11px] text-muted">Highlighted text is what the pipeline read. Click a highlight to inspect the value; a scanned image replaces this text without changing the highlights.</div>
        </div>
      </section>

      {/* Selected value, its evidence trail, and the position map */}
      <section className="grid content-start gap-4">
        <div className="card p-5">
          {sel ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="ref pointer-events-none">{sel.id}</span>
                  <div className="mt-1.5 text-[13.5px] font-semibold leading-5">{sel.label}</div>
                </div>
                <Badge tone={sel.confidence < LOW_CONFIDENCE ? "warn" : "ok"} dot>
                  {fmtPct(sel.confidence)}
                </Badge>
              </div>
              <div className="my-3 font-mono text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{sel.display}</div>
              {!sel.located ? (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-[12px] text-warn">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    The pipeline read <span className="font-mono">{sel.textAsRead || "(nothing)"}</span>, which is not printed on this page. Treat this value as unverified.
                  </span>
                </div>
              ) : null}
              <KV
                className="text-[12.5px]"
                rows={[
                  ["Field", <span key="f" className="font-mono text-[11.5px]">{sel.field}</span>],
                  ["Type", sel.valueType.replace(/_/g, " ")],
                  ["Text as read", <span key="t" className="font-mono text-[11.5px]">{sel.textAsRead || "(nothing printed)"}</span>],
                  ["Page", String(sel.page)],
                ]}
              />
              <SectionTitle className="mt-4">Lands on · {data.version}</SectionTitle>
              {sel.landsOn.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-2 text-[12px] text-muted">No return line cites this value.</p>
              ) : (
                <ul className="grid gap-1.5 text-[12.5px]">
                  {sel.landsOn.map((l) => (
                    <li key={l.key} className="flex items-center gap-2">
                      <Link href={lineHref(l.key, data.version)} className="ref">
                        {l.key}
                      </Link>
                      <span className="min-w-0 truncate text-muted">{l.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="flex items-start gap-3 text-[13px] text-muted">
              <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>Select a highlighted field on the page, or a value in the list, to see where it came from and where it went.</span>
            </div>
          )}
        </div>

        {sel ? <FactsPanel target={sel.id} facts={facts[sel.id] ?? []} actor={ctx.actor} staff={ctx.staff} verificationTypes={ctx.verificationTypes} title="Evidence on this value" /> : null}

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <SectionTitle className="mb-0">Position on page {page}</SectionTitle>
            <span className="text-[11px] text-muted">{onThisPage.length} boxes</span>
          </div>
          <div className="relative mx-auto mt-3 w-full max-w-[220px] overflow-hidden rounded-md border border-border-strong bg-surface-2 shadow-[var(--card-inset)]" style={{ aspectRatio: "8.5 / 11" }}>
            <span className="pointer-events-none absolute bottom-1.5 right-2 font-mono text-[9px] text-muted">{page}</span>
            {onThisPage.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => select(v.id)}
                title={v.label + " · " + v.display}
                aria-label={v.label}
                className={cn("absolute rounded-[2px] border transition-colors", selected === v.id ? "z-10 border-accent bg-accent/70 shadow-[0_0_0_2px_var(--ring)]" : "border-accent/50 bg-accent/15 hover:bg-accent/40")}
                style={{
                  left: v.position.x0 * 100 + "%",
                  top: v.position.y0 * 100 + "%",
                  width: Math.max((v.position.x1 - v.position.x0) * 100, 1.5) + "%",
                  height: Math.max((v.position.y1 - v.position.y0) * 100, 1) + "%",
                }}
              />
            ))}
          </div>
          <p className="mt-2.5 text-[11px] leading-4 text-muted">Positions come from the extraction pipeline. When a scanned image replaces the simulated page, these boxes overlay it unchanged.</p>
        </div>
      </section>
    </div>
  );
}
