import { Search as SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, Empty } from "@/components/ui";
import { canSeeLedger } from "@/lib/permissions";
import { getReviewContext } from "@/lib/review";
import { GROUP_LABELS, search } from "@/lib/search";
import { getViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Search" };

function highlight(text: string, terms: string[]) {
  if (!terms.length) return text;
  const re = new RegExp("(" + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "ig");
  const parts = text.split(re);
  const hit = new Set(terms);
  return parts.map((p, i) => (hit.has(p.toLowerCase()) ? <mark key={i} className="rounded bg-accent-soft px-0.5 text-foreground">{p}</mark> : <span key={i}>{p}</span>));
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { actor, literals } = await getViewer();
  const ctx = await getReviewContext();
  const result = search(ctx.packet, ctx.index, ctx.ledger, ctx.checks, q, { staff: canSeeLedger(actor), literals });

  return (
    <>
      <PageHeader
        title={result.query ? "Search: " + result.query : "Search"}
        description="Every return line, document and value read from it, the client's answers, messages and calls, the checks' findings, the timeline, people and assets, and for staff the workpaper's own records. Ids still jump straight to the record."
        meta={result.query ? <Badge tone="neutral">{result.total} result{result.total === 1 ? "" : "s"}</Badge> : null}
      />
      <form action="/search" className="relative mb-4 max-w-2xl">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input name="q" defaultValue={result.query} autoFocus placeholder="Try: Northlake, Paywell, 1099-K, Subaru, SEK, home office, Theo" className="h-10 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-[14px] outline-none placeholder:text-muted focus:border-accent" suppressHydrationWarning />
      </form>

      {!result.query ? (
        <Empty>Type a word or an amount. Searching a reference such as F1040.11 or D30 opens it directly.</Empty>
      ) : result.total === 0 ? (
        <Empty>Nothing in the file mentions &ldquo;{result.query}&rdquo;.</Empty>
      ) : (
        <div className="grid gap-4">
          {result.exact ? (
            <p className="text-[13px] text-muted">
              Exact reference:{" "}
              <Link href={result.exact} className="text-accent hover:underline">
                open {result.query}
              </Link>
            </p>
          ) : null}
          {result.byGroup.map((g) => (
            <Card key={g.group} title={GROUP_LABELS[g.group]} aside={g.hits.length + (result.hits.filter((h) => h.group === g.group).length > g.hits.length ? " of " + result.hits.filter((h) => h.group === g.group).length : "")} flush>
              <ul className="divide-y divide-border">
                {g.hits.map((h) => (
                  <li key={h.id}>
                    <Link href={h.href} className="block px-4 py-2.5 hover:bg-surface-2/60">
                      <div className="text-[13px] font-medium">{highlight(h.title, result.terms)}</div>
                      <div className="mt-0.5 line-clamp-2 text-[12px] leading-4 text-muted">{highlight(h.detail.slice(0, 300), result.terms)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
