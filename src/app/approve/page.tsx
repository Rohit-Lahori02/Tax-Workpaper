import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ClientApprovalForm, RequestApprovalForm } from "@/components/review/approval-forms";
import { Badge, Card, KV, Stat } from "@/components/ui";
import { fmtBalance, fmtDateTime, fmtMoney } from "@/lib/format";
import { canRequestApproval } from "@/lib/permissions";
import { getReviewContext } from "@/lib/review";
import { getCurrentActor } from "@/lib/session";

export const metadata: Metadata = { title: "Client approval" };

export default async function ApprovePage() {
  const actor = await getCurrentActor();
  const ctx = await getReviewContext();
  const { client, eff, levels, statuses } = ctx;
  const top = levels[levels.length - 1];
  const topStatus = statuses.find((s) => s.scope.id === "return" && s.level === top);
  const ws = eff.workingSummary;
  const me = client.signers.find((s) => s.actorId === actor.id);
  const isClient = actor.kind === "client";
  const openForMe = ctx.ledger.questions.filter((q) => !q.retracted && q.body.to === "client" && q.answers.every((a) => a.retracted)).length;

  return (
    <>
      <PageHeader
        title={isClient ? "Approve your 2025 return" : "Client approval and e-file authorization"}
        description={
          isClient
            ? "Your preparer sends the finished return here. Read the summary, ask anything that is unclear, then sign. Both spouses sign for a joint return."
            : "The client approves exactly what the partner signed. The request carries the return's fingerprint; if anything changes afterwards, the approval reopens and must be re-sent."
        }
        meta={
          <>
            {client.request ? (
              <Badge tone={client.requestCurrent ? "accent" : "warn"} dot>
                {client.requestCurrent ? "sent " + fmtDateTime(client.request.at) : "sent, but the return changed since"}
              </Badge>
            ) : (
              <Badge tone="neutral">not yet sent to the client</Badge>
            )}
            {client.complete ? (
              <Badge tone="ok" dot>
                approved by both spouses
              </Badge>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Federal total tax" value={fmtMoney(ws.federal.total_tax)} />
        <Stat label="Federal balance" value={fmtBalance(ws.federal.balance_due)} tone={ws.federal.balance_due > 0 ? "warn" : "ok"} />
        <Stat label="California total tax" value={fmtMoney(ws.california.total_tax)} />
        <Stat label="California balance" value={fmtBalance(ws.california.balance_due)} tone={ws.california.balance_due < 0 ? "ok" : undefined} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="What is being approved" className="xl:col-span-2">
          <KV
            rows={[
              ["Return", eff.version + (eff.adjustments.length ? " with " + eff.adjustments.length + " adjustment" + (eff.adjustments.length === 1 ? "" : "s") + " applied" : " as computed")],
              ["Fingerprint", <span key="h" className="font-mono text-[11px]">{ctx.returnHash.slice(0, 16)}…</span>],
              [top + " sign-off", topStatus ? topStatus.state + (topStatus.fact ? " · " + topStatus.fact.actorName : "") : "missing"],
              ["Refund account", ctx.packet.household.bank_account_for_refund_or_payment.bank + " · " + ctx.packet.household.bank_account_for_refund_or_payment.type],
              ["Open questions to the client", String(openForMe)],
            ]}
          />
          {!isClient ? (
            <div className="mt-4 border-t border-border pt-4">
              <RequestApprovalForm allowed={canRequestApproval(actor)} resend={Boolean(client.request && !client.requestCurrent)} />
              {!topStatus || topStatus.state !== "valid" ? (
                <p className="mt-2 text-[12px] text-muted">
                  Sending requires a current {top} sign-off on the whole return.{" "}
                  <Link href="/review" className="text-accent hover:underline">
                    Sign-offs
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card title="Signatures">
          <ul className="grid gap-3">
            {client.signers.map((s) => (
              <li key={s.actorId} className="text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{s.name}</span>
                  <Badge tone={s.state === "valid" ? "ok" : s.state === "reopened" ? "warn" : "neutral"} dot>
                    {s.state === "valid" ? "signed" : s.state === "reopened" ? "return changed since signing" : "not signed"}
                  </Badge>
                </div>
                {s.approval ? (
                  <div className="text-[12px] text-muted">
                    {fmtDateTime(s.approval.at)} · signed as {String(s.approval.body.signerName)} · PIN ···{String(s.approval.body.pinHint)}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {isClient ? (
        <Card className="mt-4" title={me?.state === "valid" ? "You have signed" : "Your signature"}>
          {!client.requestCurrent ? (
            <p className="text-[13px] text-muted">Your preparer has not sent the return for approval yet, or it changed after it was sent. You will see the form here when it is ready.</p>
          ) : me?.state === "valid" ? (
            <p className="text-[13px] text-muted">Thank you. Nothing more is needed from you unless the return changes.</p>
          ) : (
            <>
              {client.request?.body.message ? <p className="mb-3 rounded-md bg-surface-2 px-3 py-2 text-[13px]">{String(client.request.body.message)}</p> : null}
              <ClientApprovalForm defaultName={actor.name} federal={fmtBalance(ws.federal.balance_due)} california={fmtBalance(ws.california.balance_due)} />
            </>
          )}
        </Card>
      ) : null}
    </>
  );
}
