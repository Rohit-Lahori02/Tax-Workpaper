import { Mail } from "lucide-react";
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

export const metadata: Metadata = { title: "Notices" };

export default async function NoticesPage() {
  const actor = await getCurrentActor();
  if (!canSeeLedger(actor)) notFound();
  const ctx = await getReviewContext();
  const now = await getNow();
  const notices = ctx.packet.tax_agency_records.notices;

  return (
    <>
      <PageHeader title="Agency notices" description="Every letter from an agency about this household, and the response package the workpaper assembles for it: the lines, the evidence, the firm's own record, and the exposure." />
      <Card flush>
        <ul className="divide-y divide-border">
          {notices.map((n) => {
            const doc = n.document ? ctx.packet.documents.find((d) => d.id === n.document) : undefined;
            const arrived = !doc || doc.received_at <= now.iso;
            const sent = ctx.ledger.latest("notice:" + n.id, "filing");
            const due = n.response_due ? Math.ceil((Date.parse(n.response_due) - Date.parse(now.iso)) / 86400000) : null;
            return (
              <li key={n.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn">
                  <Mail className="h-3.5 w-3.5" />
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
                  <p className="mt-0.5 text-[12.5px] text-muted">{n.summary ?? (n.items_under_examination ?? []).join(" ")}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[11.5px] text-muted">
                    <span>dated {fmtDate(n.dated)}</span>
                    {n.response_due ? <span>response due {fmtDate(n.response_due)}</span> : null}
                    {n.document ? <RefLink refId={n.document} href={documentHref(n.document)} /> : null}
                    {n.status ? <span>{n.status}</span> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
