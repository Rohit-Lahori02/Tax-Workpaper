"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, cn, Empty, KV, SectionTitle } from "@/components/ui";
import { fmtPct } from "@/lib/format";
import type { Segment } from "@/lib/packet/pagemarks";
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
  pageCount: number;
  pages: ViewerPage[];
  values: ViewerValue[];
  version: string;
}

const LOW_CONFIDENCE = 0.8;

export function DocumentViewer({
  data,
  initialPage,
  initialValue,
}: {
  data: ViewerData;
  initialPage: number;
  initialValue: string | null;
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

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_1fr_300px]">
      {/* Values list */}
      <section className="flex max-h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-[10px] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={"Filter " + data.values.length + " values"}
              aria-label="Filter extracted values"
              className="h-8 w-full rounded-md border border-border bg-surface-2 pl-7 pr-2 text-[12px] outline-none focus:border-accent"
            />
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
              <div className="sticky top-0 z-[1] border-b border-border bg-surface-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Page {p}
              </div>
              <ul>
                {listed
                  .filter((v) => v.page === p)
                  .map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => select(v.id)}
                        className={cn(
                          "flex w-full items-start gap-2 border-b border-border px-3 py-1.5 text-left hover:bg-surface-2",
                          selected === v.id && "bg-accent-soft hover:bg-accent-soft",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px]">{v.label}</div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted">
                            <span className="font-mono">{v.id}</span>
                            {!v.located ? (
                              <span className="text-warn" title="Text as read was not found on the printed page">
                                not on page
                              </span>
                            ) : null}
                            {v.landsOn.length === 0 ? <span title="No return line cites this value">unused</span> : null}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-[12px] tabular-nums">{v.display}</div>
                          <div className={cn("text-[11px]", v.confidence < LOW_CONFIDENCE ? "font-medium text-warn" : "text-muted")}>
                            {fmtPct(v.confidence)}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* The page */}
      <section className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="inline-flex items-center rounded-md border border-border bg-surface text-[12px]">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-2 py-1 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="border-x border-border px-3 py-1 font-medium">
              Page {page} of {data.pageCount}
            </span>
            <button
              type="button"
              disabled={page >= data.pageCount}
              onClick={() => setPage(page + 1)}
              className="px-2 py-1 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="text-[11px] text-muted">
            {current ? current.segments.filter((s) => s.valueId).length : 0} fields located on this page
          </div>
        </div>
        <div
          ref={sheetRef}
          className="rounded-[10px] border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8"
          style={{ minHeight: "28rem" }}
        >
          <div className="mb-4 flex items-center justify-between border-b border-dashed border-border pb-2 text-[11px] uppercase tracking-wide text-muted">
            <span>Simulated page · {data.docId}</span>
            <span>
              {page} / {data.pageCount}
            </span>
          </div>
          {current ? (
            <p className="whitespace-pre-wrap font-mono text-[12.5px] leading-6">
              {current.segments.map((s, i) =>
                s.valueId ? (
                  <mark
                    key={i}
                    data-value={s.valueId}
                    className={cn("ev", selected === s.valueId && "is-selected")}
                    onClick={() => select(s.valueId!)}
                    title={byId.get(s.valueId)?.label}
                  >
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
      </section>

      {/* Selected value + position map */}
      <section className="grid content-start gap-4">
        <div className="rounded-[10px] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          {sel ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-muted">{sel.id}</div>
                  <div className="text-[13px] font-medium">{sel.label}</div>
                </div>
                <Badge tone={sel.confidence < LOW_CONFIDENCE ? "warn" : "ok"}>{fmtPct(sel.confidence)}</Badge>
              </div>
              <div className="my-3 text-2xl font-semibold tabular-nums tracking-tight">{sel.display}</div>
              {!sel.located ? (
                <div className="mb-3 flex items-start gap-2 rounded-md bg-warn-soft px-2.5 py-2 text-[12px] text-warn">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    The pipeline read <span className="font-mono">{sel.textAsRead || "(nothing)"}</span>, which is not printed on this page.
                    Treat this value as unverified.
                  </span>
                </div>
              ) : null}
              <KV
                rows={[
                  ["Field", <span key="f" className="font-mono text-xs">{sel.field}</span>],
                  ["Type", sel.valueType],
                  ["Text as read", <span key="t" className="font-mono text-xs">{sel.textAsRead || "(nothing printed)"}</span>],
                  ["Page", String(sel.page)],
                ]}
              />
              <SectionTitle className="mt-4">Lands on · {data.version}</SectionTitle>
              {sel.landsOn.length === 0 ? (
                <p className="text-[12px] text-muted">No return line cites this value.</p>
              ) : (
                <ul className="grid gap-1 text-[12px]">
                  {sel.landsOn.map((l) => (
                    <li key={l.key} className="flex items-baseline gap-2">
                      <Link href={lineHref(l.key, data.version)} className="font-mono text-accent hover:underline">
                        {l.key}
                      </Link>
                      <span className="min-w-0 truncate text-muted">{l.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-[13px] text-muted">
              Select a highlighted field on the page, or a value in the list, to see where it came from and where it went.
            </p>
          )}
        </div>

        <div className="rounded-[10px] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <SectionTitle>Position on page {page}</SectionTitle>
          <div className="relative mx-auto w-full max-w-[220px] rounded border border-border-strong bg-background" style={{ aspectRatio: "8.5 / 11" }}>
            {data.values
              .filter((v) => v.page === page)
              .map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => select(v.id)}
                  title={v.label + " · " + v.display}
                  aria-label={v.label}
                  className={cn(
                    "absolute rounded-[2px] border",
                    selected === v.id ? "z-10 border-accent bg-accent/60" : "border-accent/50 bg-accent/15 hover:bg-accent/35",
                  )}
                  style={{
                    left: v.position.x0 * 100 + "%",
                    top: v.position.y0 * 100 + "%",
                    width: Math.max((v.position.x1 - v.position.x0) * 100, 1.5) + "%",
                    height: Math.max((v.position.y1 - v.position.y0) * 100, 1) + "%",
                  }}
                />
              ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Positions come from the extraction pipeline. When a scanned image replaces the simulated page, these boxes overlay it unchanged.
          </p>
        </div>
      </section>
    </div>
  );
}
