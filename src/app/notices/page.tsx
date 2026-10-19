import { ArrowUpRight, Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { canSeeLedger } from "@/lib/permissions";
import { documentHref } from "@/lib/refs";
import { getReviewContext } from "@/lib/review";
import { getCurrentActor, getNow } from "@/lib/session";
import { staffOnlyPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Notices" };

export default async function NoticesPage() {
  await staffOnlyPage();
  const actor = await getCurrentActor();
  if (!canSeeLedger(actor)) notFound();
  const ctx = await getReviewContext();
  const now = await getNow();
  const notices = ctx.packet.tax_agency_records.notices;

  return (
    <>
      <PageHeader eyebrow="Filing" title="Agency notices" meta={<Badge tone="neutral">{notices.length} notices on file</Badge>} description="Every letter from an agency about this household, and the response package the workpaper assembles for it: the lines, the evidence, the firm's own record, and the exposure." />
      <Card flush>
        <ul className="divide-y divide-border">
          {notices.map((n) => {
            const doc = n.document ? ctx.packet.documents.find((d) => d.id === n.document) : undefined;
            const arrived = !doc || doc.received_at <= now.iso;
            const sent = ctx.ledger.latest("notice:" + n.id, "filing");
            const due = n.response_due ? Math.ceil((Date.parse(n.response_due) - Date.parse(now.iso)) / 86400000) : null;
            return (
              <li key={n.id} className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-surface-2/40">
                <span className={"mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset " + (n.status || sent ? "bg-ok-soft text-ok ring-ok/25" : arrived ? "bg-warn-soft text-warn ring-warn/25" : "bg-surface-2 text-muted ring-border")}>
                  <Mail className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={"/notices/" + n.id} className="text-[13.5px] font-medium hover:underline">
                      {n.agency} {n.type} · tax year {n.tax_year}
                    </Link>
                    <Badge tone="neutral" mono>
                      {n.id}
                    </Badge>
                    {!arrived ? <Badge tone="neutral">arrives {doc ? fmtDate(doc.received_at) : ""}</Badge> : null}
                    {n.status ? (
                      <Badge tone="ok" dot>
                        resolved
                      </Badge>
                    ) : sent ? (
                      <Badge tone="ok" dot>
                        response sent {fmtDate(sent.at)}
                      </Badge>
                    ) : due !== null && arrived ? (
                      <Badge tone={due < 0 ? "danger" : due <= 14 ? "warn" : "accent"} dot>
                        {due < 0 ? "response overdue" : "response due in " + due + " day" + (due === 1 ? "" : "s")}
                      </Badge>
                    ) : null}
                  </div>
                  {n.items_under_examination?.length ? (
                    <ol className="mt-1.5 grid gap-1 text-[12.5px] leading-5 text-muted">
                      {n.items_under_examination.map((item, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="font-mono text-[10.5px] text-muted/70">{i + 1}.</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-1 text-[12.5px] leading-5 text-muted">{n.summary}</p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[11.5px] text-muted">
                    <span>dated {fmtDate(n.dated)}</span>
                    {n.response_due ? <span>response due {fmtDate(n.response_due)}</span> : null}
                    {n.document ? <RefLink refId={n.document} href={documentHref(n.document)} /> : null}
                    {n.status ? <span>{n.status}</span> : null}
                  </div>
                </div>
                <Link href={"/notices/" + n.id} className="pill h-8 shrink-0">
                  {n.status ? "Open record" : "Open package"} <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
