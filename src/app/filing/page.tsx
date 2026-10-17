import { CheckCircle2, OctagonAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, Stat } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { getReviewContext } from "@/lib/review";

export const metadata: Metadata = { title: "Filing readiness" };

export default async function FilingPage() {
  const ctx = await getReviewContext();
  const ok = ctx.gates.filter((g) => g.ok).length;
  const ready = ok === ctx.gates.length;
  const deadlines = ctx.packet.firm.deadlines.filter((d) => /due date/i.test(d.what));

  return (
    <>
      <PageHeader
        title="Filing readiness"
        description="Every gate the firm's standards put between a prepared return and an e-filed one. Each is computed; none can be ticked by hand."
        meta={
          ready ? (
            <Badge tone="ok" dot>
              ready to file
            </Badge>
          ) : (
            <Badge tone="danger" dot>
              {ctx.gates.length - ok} gate{ctx.gates.length - ok === 1 ? "" : "s"} closed
            </Badge>
          )
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Gates open" value={ok + " / " + ctx.gates.length} tone={ready ? "ok" : "danger"} />
        <Stat label="Working return" value={ctx.eff.version + (ctx.eff.adjustments.length ? " +" + ctx.eff.adjustments.length : "")} hint="version plus adjustments" />
        {deadlines.map((d) => (
          <Stat key={d.what} label={d.what.replace(/ - /, " · ")} value={fmtDate(d.date)} />
        ))}
      </div>
      <Card className="mt-4" flush>
        <ul className="divide-y divide-border">
          {ctx.gates.map((g) => (
            <li key={g.id} className="flex items-start gap-3 px-4 py-3">
              {g.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-ok" /> : <OctagonAlert className="mt-0.5 h-4 w-4 text-danger" />}
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium">{g.label}</div>
                <p className="text-[12.5px] text-muted">{g.detail}</p>
              </div>
              <Link href={g.href} className="text-[12px] text-accent hover:underline">
                open
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <p className="mt-4 text-[12px] text-muted">Extension, e-file submission, rejections and the client copy come with the filing timeline (Phase 7).</p>
    </>
  );
}
