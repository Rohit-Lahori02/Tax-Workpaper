import { ArrowRight, BookMarked, CalendarClock, FileText, Hash, MessageSquare, Package, ScanSearch, Search as SearchIcon, ShieldAlert, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge, cn, Empty, Kbd, Pill } from "@/components/ui";
import { canSeeLedger } from "@/lib/permissions";
import { parseRef } from "@/lib/refs";
import { getReviewContext } from "@/lib/review";
import { GROUP_LABELS, search, type SearchGroup, type SearchHit } from "@/lib/search";
import { getViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Search" };

const GROUP_ICON: Record<SearchGroup, ReactNode> = {
  lines: <Hash className="h-3.5 w-3.5" />,
  documents: <FileText className="h-3.5 w-3.5" />,
  values: <ScanSearch className="h-3.5 w-3.5" />,
  client: <MessageSquare className="h-3.5 w-3.5" />,
  checks: <ShieldAlert className="h-3.5 w-3.5" />,
  records: <BookMarked className="h-3.5 w-3.5" />,
  timeline: <CalendarClock className="h-3.5 w-3.5" />,
  people: <Users className="h-3.5 w-3.5" />,
  assets: <Package className="h-3.5 w-3.5" />,
};

const GROUP_HINT: Record<SearchGroup, string> = {
  lines: "every line of the working return, by key, label, value and rule",
  documents: "titles, issuers, file names and the printed text of each page",
  values: "what the pipeline read off each page, and where it landed",
  client: "the organizer answers, portal messages and call notes",
  checks: "the findings of every check on the working return",
  records: "verifications, notes, questions, adjustments and sign-offs (staff only)",
  timeline: "what happened to the engagement, and when",
  people: "the household and the firm's staff",
  assets: "the depreciation schedule",
};

const EXAMPLES = ["Northlake", "Paywell", "1099-K", "Subaru", "SEK", "home office", "Theo", "36,000"];

const ORDER = Object.keys(GROUP_LABELS) as SearchGroup[];
const ALL_CAP = 8;

function highlight(text: string, terms: string[]) {
  if (!terms.length) return text;
  const re = new RegExp("(" + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "ig");
  const parts = text.split(re);
  const hit = new Set(terms);
  return parts.map((p, i) => (hit.has(p.toLowerCase()) ? <mark key={i} className="rounded-[3px] bg-accent-soft px-0.5 text-foreground shadow-[inset_0_-1.5px_0_var(--accent)]">{p}</mark> : <span key={i}>{p}</span>));
}

/** Split "id · label" titles so the id can be drawn as a chip. */
function splitTitle(h: SearchHit): { id: string | null; title: string } {
  const i = h.title.indexOf(" · ");
  if (i > 0) {
    const head = h.title.slice(0, i);
    if (head === h.id || parseRef(head).kind !== "unknown") return { id: head, title: h.title.slice(i + 3) };
  }
  return { id: null, title: h.title };
}

/** Trim the detail to the first window that contains a search term, so the match is visible. */
function snippet(detail: string, terms: string[], width = 220): string {
  const d = detail.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = d.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0 || at < width / 2) return detail.length > width ? detail.slice(0, width) + "…" : detail;
  const start = Math.max(0, at - Math.floor(width / 3));
  const cut = detail.slice(start, start + width);
  return "…" + cut + (start + width < detail.length ? "…" : "");
}

function Hit({ h, terms }: { h: SearchHit; terms: string[] }) {
  const { id, title } = splitTitle(h);
  return (
    <li>
      <Link href={h.href} className="group flex items-start gap-3 px-5 py-2.5 hover:bg-surface-2/60">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted ring-1 ring-inset ring-border group-hover:text-accent">{GROUP_ICON[h.group]}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {id ? <span className="ref pointer-events-none">{highlight(id, terms)}</span> : null}
            <span className="text-[13px] font-medium leading-5">{highlight(title, terms)}</span>
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[12px] leading-4 text-muted">{highlight(snippet(h.detail, terms), terms)}</span>
        </span>
        <ArrowRight className="mt-1.5 h-3.5 w-3.5 shrink-0 text-border-strong group-hover:text-accent" />
      </Link>
    </li>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; in?: string }> }) {
  const { q = "", in: inParam } = await searchParams;
  const { actor, literals } = await getViewer();
  const ctx = await getReviewContext();
  const staff = canSeeLedger(actor);
  const result = search(ctx.packet, ctx.index, ctx.ledger, ctx.checks, q, { staff, literals });

  const counts = new Map<SearchGroup, number>();
  for (const h of result.hits) counts.set(h.group, (counts.get(h.group) ?? 0) + 1);
  const present = ORDER.filter((g) => counts.get(g));
  const picked = inParam && present.includes(inParam as SearchGroup) ? (inParam as SearchGroup) : null;
  const href = (g: SearchGroup | null) => "/search?q=" + encodeURIComponent(result.query) + (g ? "&in=" + g : "");
  const asRef = result.query && !/\s/.test(result.query) ? parseRef(result.query) : null;

  return (
    <>
      <PageHeader
        eyebrow="Find"
        title={result.query ? <>Results for &ldquo;{result.query}&rdquo;</> : "Search the file"}
        description={
          result.query
            ? (result.total ? result.total + " match" + (result.total === 1 ? "" : "es") + " across " + present.length + " kind" + (present.length === 1 ? "" : "s") + " of record" : "No matches") + ". Every word must appear; order does not matter."
            : "One box for everything in the file: return lines, documents and the values read from them, the client's answers, messages and calls, check findings, the timeline, people, assets" + (staff ? " and the workpaper's own records" : "") + ". A reference like F1040.11 or D30 jumps straight to its record."
        }
      />

      <form action="/search" className="relative mb-5 max-w-2xl">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input name="q" defaultValue={result.query} autoFocus placeholder="Search by word, amount, name or reference" aria-label="Search the file" className="input h-11 w-full pl-10 pr-14 text-[14px]" suppressHydrationWarning autoComplete="off" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <Kbd>↵</Kbd>
        </span>
      </form>

      {!result.query ? (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12px] text-muted">Try</span>
            {EXAMPLES.map((e) => (
              <Link key={e} href={"/search?q=" + encodeURIComponent(e)} className="chip">
                {e}
              </Link>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ORDER.filter((g) => g !== "records" || staff).map((g) => (
              <div key={g} className="card flex items-start gap-3 p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent ring-1 ring-inset ring-accent/25">{GROUP_ICON[g]}</span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold leading-5">{GROUP_LABELS[g]}</span>
                  <span className="block text-[12px] leading-4 text-muted">{GROUP_HINT[g]}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-muted">
            Press <Kbd>/</Kbd> anywhere to jump to the box at the top. Sensitive identifiers stay masked in results unless the file is in reveal.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {result.exact ? (
            <div className="card flex flex-wrap items-center justify-between gap-3 border-accent/30 bg-accent-soft/30 px-5 py-3">
              <span className="flex items-center gap-3 text-[13px]">
                <span className="ref pointer-events-none">{result.query}</span>
                <span>is a reference in the packet. Open the record itself, or keep reading the mentions below.</span>
              </span>
              <Pill href={result.exact} primary icon={<ArrowRight className="h-3.5 w-3.5" />}>
                Open {result.query}
              </Pill>
            </div>
          ) : asRef && asRef.kind !== "unknown" && result.total === 0 ? (
            <div className="card flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[13px]">
              <span>
                That reads like a {asRef.kind.replace(/_/g, " ")} reference, but nothing in the packet carries it. References are spelled like <span className="font-mono">F1040.11</span>, <span className="font-mono">ev-0703</span>, <span className="font-mono">D30</span>, <span className="font-mono">qa-14</span>, <span className="font-mono">asset:SAC-BLDG</span> or <span className="font-mono">py:/carryovers_into_2025</span>.
              </span>
            </div>
          ) : null}

          {result.total === 0 ? (
            <Empty>
              Nothing in the file mentions &ldquo;{result.query}&rdquo;. Try fewer words, a single distinctive one, or the amount exactly as printed (36,000 rather than 36000).
            </Empty>
          ) : (
            <>
              <nav className="seg flex-wrap" aria-label="Filter results by kind">
                <Link href={href(null)} className={cn("seg-item", !picked && "is-active")}>
                  All
                  <span className="ml-1.5 font-mono text-[10.5px] tabular-nums opacity-70">{result.total}</span>
                </Link>
                {present.map((g) => (
                  <Link key={g} href={href(g)} className={cn("seg-item", picked === g && "is-active")}>
                    {GROUP_LABELS[g]}
                    <span className="ml-1.5 font-mono text-[10.5px] tabular-nums opacity-70">{counts.get(g)}</span>
                  </Link>
                ))}
              </nav>

              {(picked ? [picked] : present).map((g) => {
                const all = result.hits.filter((h) => h.group === g);
                const shown = picked ? all : all.slice(0, ALL_CAP);
                return (
                  <section key={g} id={"g-" + g} className="card overflow-hidden">
                    <header className="flex items-center justify-between gap-3 px-5 py-3">
                      <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                        <span className="text-muted">{GROUP_ICON[g]}</span>
                        {GROUP_LABELS[g]}
                        <Badge tone="neutral">{all.length}</Badge>
                      </h2>
                      {!picked && all.length > shown.length ? (
                        <Link href={href(g)} className="flex items-center gap-1 text-[12px] text-accent hover:underline">
                          all {all.length} <ArrowRight className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </header>
                    <ul className="divide-y divide-border border-t border-border">
                      {shown.map((h) => (
                        <Hit key={h.id} h={h} terms={result.terms} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </>
          )}
        </div>
      )}
    </>
  );
}
