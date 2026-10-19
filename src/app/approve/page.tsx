import { AlertTriangle, ArrowRight, BookOpen, Check, CheckCircle2, Circle, FileSignature, MessageCircleQuestion, Send, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { ClientApprovalForm, RequestApprovalForm } from "@/components/review/approval-forms";
import { Badge, Card, cn, Empty, KV, Pill, Stat, type Tone } from "@/components/ui";
import type { FactView } from "@/lib/facts/types";
import { fmtBalance, fmtDateTime, fmtMoney, fmtNumber } from "@/lib/format";
import { canRequestApproval } from "@/lib/permissions";
import { lineHref } from "@/lib/refs";
import { getReviewContext } from "@/lib/review";
import { getCurrentActor } from "@/lib/session";

export const metadata: Metadata = { title: "Client approval" };

type StepState = "done" | "stale" | "todo" | "blocked";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const STEP_TONE: Record<StepState, Tone> = { done: "ok", stale: "warn", todo: "neutral", blocked: "neutral" };

function StepIcon({ state }: { state: StepState }) {
  return (
    <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", state === "done" ? "bg-ok-soft text-ok ring-ok/25" : state === "stale" ? "bg-warn-soft text-warn ring-warn/30" : "bg-surface-2 text-muted ring-border")}>
      {state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : state === "stale" ? <AlertTriangle className="h-3.5 w-3.5" /> : <Circle className="h-2 w-2 fill-current" />}
    </span>
  );
}

/** A plain-words line of a balance, for the client. */
function owed(label: string, n: number): string {
  if (n > 0) return "You owe " + label + " " + fmtMoney(n);
  if (n < 0) return label + " refunds you " + fmtMoney(-n);
  return "Nothing owed to " + label;
}

export default async function ApprovePage() {
  const actor = await getCurrentActor();
  const ctx = await getReviewContext();
  const { client, eff, levels, statuses, ledger, packet } = ctx;
  const top = levels[levels.length - 1];
  const topStatus = statuses.find((s) => s.scope.id === "return" && s.level === top);
  const ws = eff.workingSummary;
  const me = client.signers.find((s) => s.actorId === actor.id);
  const isClient = actor.kind === "client";
  const openForClient = ledger.questions.filter((q) => !q.retracted && q.body.to === "client" && q.answers.every((a) => a.retracted));
  const blockingGate = ctx.gates.find((g) => g.id === "blocking-notes");
  const partnerOk = Boolean(topStatus && topStatus.state === "valid");
  const canSend = partnerOk && (!blockingGate || blockingGate.ok);
  const topName = topStatus?.fact?.actorName ?? null;
  const bank = packet.household.bank_account_for_refund_or_payment;

  // Where things stand, as a short path: partner → sent → each signer → ready.
  const steps: { key: string; label: string; detail: string; state: StepState }[] = [
    {
      key: "partner",
      label: top[0].toUpperCase() + top.slice(1) + " sign-off on the whole return",
      detail: !topStatus || topStatus.state === "missing" ? "not yet signed" : topStatus.state === "reopened" ? "reopened: the return changed after " + (topName ?? "the signer") + " signed" : "signed by " + topName,
      state: !topStatus || topStatus.state === "missing" ? "todo" : topStatus.state === "reopened" ? "stale" : "done",
    },
    {
      key: "sent",
      label: "Sent to the client",
      detail: !client.request ? "not yet sent" : client.requestCurrent ? fmtDateTime(client.request.at) + " by " + client.request.actorName : "sent " + fmtDateTime(client.request.at) + ", but the return changed since",
      state: !client.request ? "todo" : client.requestCurrent ? "done" : "stale",
    },
    ...client.signers.map((s) => ({
      key: s.actorId,
      label: s.name + " signs",
      detail: !s.approval ? "waiting" : s.state === "valid" ? "signed " + fmtDateTime(s.approval.at) : "signed " + fmtDateTime(s.approval.at) + ", before the return changed",
      state: (!s.approval ? "todo" : s.state === "valid" ? "done" : "stale") as StepState,
    })),
    {
      key: "ready",
      label: "Ready to e-file",
      detail: client.complete && partnerOk ? "approval is current; see Filing for the remaining gates" : "needs every signature on the current return",
      state: client.complete && partnerOk ? "done" : "todo",
    },
  ];

  // What the client signed last time, against what the return says now.
  const lastApproval = client.signers.map((s) => s.approval).filter((a): a is FactView => Boolean(a)).sort((a, b) => b.seq - a.seq)[0] ?? null;
  const signedFed = lastApproval ? Number(lastApproval.body.federalBalance) : null;
  const signedCa = lastApproval ? Number(lastApproval.body.californiaBalance) : null;
  const moved = lastApproval && !client.complete && (signedFed !== ws.federal.balance_due || signedCa !== ws.california.balance_due);

  // Approval history on the return: requests and signatures, newest first.
  const history = ledger.forTarget("return").filter((f) => f.kind === "approval_request" || f.kind === "approval");

  const delta = (now: number, then: number | null) => (then === null || then === now ? undefined : { text: (now - then > 0 ? "+" : "−") + fmtMoney(Math.abs(now - then)) + " since signed", tone: (now - then > 0 ? "warn" : "ok") as Tone });

  const summaryTiles: ReactNode = (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Federal total tax" value={fmtMoney(ws.federal.total_tax)} hint={isClient ? "for tax year 2025" : eff.version + (eff.adjustments.length ? " + " + eff.adjustments.length + " adj." : "")} />
      <Stat label="Federal balance" value={fmtBalance(ws.federal.balance_due)} tone={ws.federal.balance_due > 0 ? "warn" : "ok"} hint={isClient ? owed("the IRS", ws.federal.balance_due) : undefined} delta={delta(ws.federal.balance_due, signedFed)} />
      <Stat label="California total tax" value={fmtMoney(ws.california.total_tax)} hint={isClient ? "Form 540NR" : undefined} />
      <Stat label="California balance" value={fmtBalance(ws.california.balance_due)} tone={ws.california.balance_due > 0 ? "warn" : "ok"} hint={isClient ? owed("California", ws.california.balance_due) : undefined} delta={delta(ws.california.balance_due, signedCa)} />
    </div>
  );

  // ---------- Client view ----------
  if (isClient) {
    const other = client.signers.filter((s) => s.actorId !== actor.id);
    const waitingOnMe = client.requestCurrent && me && me.state !== "valid";
    return (
      <>
        <PageHeader
          eyebrow="Your return"
          title="Approve your 2025 return"
          description={
            waitingOnMe
              ? "Your preparer has sent the finished return for your approval. Read the summary, ask anything that is unclear, then sign below. Both spouses sign for a joint return."
              : me?.state === "valid"
                ? "You have signed. Nothing more is needed from you unless the return changes, in which case it comes back here."
                : "Your preparer sends the finished return here when it is ready. You will get a line in your work list when it is."
          }
          meta={
            <>
              {waitingOnMe ? (
                <Badge tone="accent" dot>
                  waiting for your signature
                </Badge>
              ) : me?.state === "valid" ? (
                <Badge tone="ok" dot>
                  you signed {me.approval ? fmtDateTime(me.approval.at) : ""}
                </Badge>
              ) : (
                <Badge tone="neutral">not ready yet</Badge>
              )}
              {openForClient.length ? (
                <Link href="/questions" className="chip">
                  <MessageCircleQuestion className="h-3.5 w-3.5" /> {openForClient.length} question{openForClient.length === 1 ? "" : "s"} for you
                </Link>
              ) : null}
            </>
          }
          actions={
            <Pill href="/client-copy" icon={<BookOpen className="h-3.5 w-3.5" />}>
              Read the full return
            </Pill>
          }
        />

        {summaryTiles}

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <div className="grid content-start gap-4 xl:col-span-2">
            {waitingOnMe ? (
              <Card
                title={
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent ring-1 ring-inset ring-accent/25">
                      <FileSignature className="h-3.5 w-3.5" />
                    </span>
                    Your signature
                  </span>
                }
                description="Signing here is the same as signing IRS Form 8879 and the California FTB 8879 on paper: it lets the firm file on your behalf."
              >
                {client.request?.body.message ? (
                  <div className="mb-4 flex items-start gap-3 rounded-lg border border-border bg-surface-2/40 px-4 py-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-[11px] font-semibold text-accent">{initials(client.request.actorName)}</span>
                    <div className="min-w-0">
                      <div className="text-[11px] text-muted">
                        {client.request.actorName} wrote, {fmtDateTime(client.request.at)}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-5">{String(client.request.body.message)}</p>
                    </div>
                  </div>
                ) : null}
                <ClientApprovalForm defaultName={actor.name} federal={fmtBalance(ws.federal.balance_due)} california={fmtBalance(ws.california.balance_due)} />
              </Card>
            ) : me?.state === "valid" ? (
              <div className="card flex items-start gap-3 px-5 py-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok" />
                <div className="text-[13px] leading-5">
                  <div className="font-medium">Signed as {String(me.approval?.body.signerName ?? actor.name)}</div>
                  <div className="text-muted">
                    {me.approval ? fmtDateTime(me.approval.at) : ""} · PIN ending {String(me.approval?.body.pinHint ?? "")} · federal {fmtBalance(Number(me.approval?.body.federalBalance ?? 0))}, California {fmtBalance(Number(me.approval?.body.californiaBalance ?? 0))}
                  </div>
                </div>
              </div>
            ) : (
              <Empty>{client.request ? "The return changed after it was sent to you. Your preparer will send it again once it is final." : "Nothing to sign yet."}</Empty>
            )}

            <Card title="What you are approving" description="The figures above come from this return. The full line-by-line copy, with the documents behind it, is on the Read the full return page.">
              <KV
                className="text-[13px]"
                rows={[
                  ["Tax year", "2025, filed jointly"],
                  ["Prepared by", packet.firm.name + (topName ? ", reviewed and signed by " + topName : "")],
                  ["Refund or payment account", bank.bank + " · " + bank.type],
                  ["Reference", <span key="h" className="font-mono text-[11.5px]">{ctx.returnHash.slice(0, 12)}</span>],
                ]}
              />
            </Card>
          </div>

          <div className="grid content-start gap-4">
            <Card title="Signatures">
              <ul className="grid gap-3">
                {client.signers.map((s) => (
                  <li key={s.actorId} className="flex items-center gap-3">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold", s.state === "valid" ? "bg-ok-soft text-ok" : "bg-surface-2 text-muted")}>{initials(s.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">
                        {s.name}
                        {s.actorId === actor.id ? <span className="text-muted"> (you)</span> : null}
                      </span>
                      <span className="block text-[11.5px] text-muted">{s.state === "valid" && s.approval ? "signed " + fmtDateTime(s.approval.at) : s.state === "reopened" ? "needs to sign again" : "not signed yet"}</span>
                    </span>
                    <Badge tone={s.state === "valid" ? "ok" : s.state === "reopened" ? "warn" : "neutral"} dot>
                      {s.state === "valid" ? "signed" : "waiting"}
                    </Badge>
                  </li>
                ))}
              </ul>
              {other.length && client.requestCurrent ? <p className="mt-3 text-[12px] leading-4 text-muted">{other.every((s) => s.state === "valid") ? "Everyone else has signed." : "A joint return needs both signatures before it can be filed."}</p> : null}
            </Card>
            {openForClient.length ? (
              <Card title="Before you sign" description="Your preparer is still waiting on answers from you.">
                <ul className="grid gap-2">
                  {openForClient.slice(0, 4).map((q) => (
                    <li key={q.id}>
                      <Link href="/questions" className="flex items-start gap-2 text-[12.5px] leading-5 hover:text-accent">
                        <MessageCircleQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                        <span className="line-clamp-2">{String(q.body.text)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  // ---------- Staff view ----------
  return (
    <>
      <PageHeader
        eyebrow="Review"
        title="Client approval and e-file authorization"
        description="The client approves exactly what the partner signed. The request carries the return's fingerprint; if anything changes afterwards, the approval reopens and must be re-sent and re-signed."
        meta={
          <>
            {client.complete ? (
              <Badge tone="ok" dot>
                approved by both spouses
              </Badge>
            ) : client.request ? (
              <Badge tone={client.requestCurrent ? "accent" : "warn"} dot>
                {client.requestCurrent ? "sent " + fmtDateTime(client.request.at) + ", awaiting signatures" : "sent, but the return changed since"}
              </Badge>
            ) : (
              <Badge tone="neutral">not yet sent to the client</Badge>
            )}
            <Badge tone="neutral" mono title={ctx.returnHash}>
              fingerprint {ctx.returnHash.slice(0, 10)}
            </Badge>
            {openForClient.length ? <Badge tone="warn">{openForClient.length} open question{openForClient.length === 1 ? "" : "s"} to the client</Badge> : null}
          </>
        }
        actions={
          <Pill href="/filing" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
            Filing gates
          </Pill>
        }
      />

      {/* The path */}
      <ol className="card grid gap-0 sm:grid-cols-2 xl:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.key} className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
            <StepIcon state={s.state} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">step {i + 1}</div>
              <div className="text-[13px] font-medium leading-5">{s.label}</div>
              <div className={cn("text-[11.5px] leading-4", s.state === "stale" ? "text-warn" : "text-muted")}>{s.detail}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4">{summaryTiles}</div>

      {moved ? (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-[12.5px] leading-5 text-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            The balances moved after the client signed: federal {fmtBalance(signedFed ?? 0)} → {fmtBalance(ws.federal.balance_due)}, California {fmtBalance(signedCa ?? 0)} → {fmtBalance(ws.california.balance_due)}. The signatures no longer cover this return.
          </span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="grid content-start gap-4 xl:col-span-2">
          <Card
            title={
              <span className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent ring-1 ring-inset ring-accent/25">
                  <Send className="h-3.5 w-3.5" />
                </span>
                {client.request && !client.requestCurrent ? "Send the updated return" : client.requestCurrent ? "Sent and waiting" : "Send to the client"}
              </span>
            }
            description="Sending records the fingerprint of what the client will approve. Each prerequisite below is checked again at the moment of sending."
          >
            <ul className="mb-4 grid gap-1.5 text-[12.5px]">
              {[
                { ok: partnerOk, label: "Whole return has a current " + top + " sign-off", detail: (topStatus ? topStatus.state + (topName ? " · " + topName : "") : "missing") + (partnerOk ? "" : " · area sign-offs do not count; re-sign the Whole return row, preparer first"), href: "/review" },
                { ok: !blockingGate || blockingGate.ok, label: "No open blocking review notes", detail: blockingGate?.detail ?? "", href: "/review#blocking" },
                { ok: openForClient.length === 0, label: "No questions still open with the client", detail: openForClient.length ? openForClient.length + " open; sending is still allowed, but the client will be asked to answer first" : "none open", href: "/questions" },
              ].map((p) => (
                <li key={p.label} className="flex items-start gap-2">
                  {p.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />}
                  <span className="min-w-0">
                    <Link href={p.href} className="font-medium hover:text-accent">
                      {p.label}
                    </Link>
                    <span className="text-muted"> · {p.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <RequestApprovalForm allowed={canRequestApproval(actor)} resend={Boolean(client.request && !client.requestCurrent)} ready={canSend} />
            {!canRequestApproval(actor) ? <p className="text-[12px] text-muted">Preparers, reviewers and partners send the return for approval.</p> : null}
          </Card>

          <Card
            title="What the client is approving"
            description={eff.adjustments.length ? "The engine's return plus every adjustment recorded on it. The client sees the resulting figures, not the adjustments themselves; those stay in the workpaper." : "The engine's return as computed, with no adjustments."}
            aside={eff.version + (eff.adjustments.length ? " + " + eff.adjustments.length + " adjustment" + (eff.adjustments.length === 1 ? "" : "s") : "")}
            flush
          >
            <div className="px-5 py-4">
              <KV
                className="text-[13px] sm:grid-cols-[max-content_1fr_max-content_1fr]"
                rows={[
                  ["Return", eff.version],
                  ["Fingerprint", <span key="h" className="font-mono text-[11px]" title={ctx.returnHash}>{ctx.returnHash.slice(0, 24)}…</span>],
                  ["Refund account", bank.bank + " · " + bank.type],
                  [top[0].toUpperCase() + top.slice(1) + " sign-off", topStatus ? topStatus.state + (topName ? " · " + topName : "") : "missing"],
                ]}
              />
            </div>
            {eff.adjustments.length ? (
              <table className="tbl dense border-t border-border">
                <thead>
                  <tr>
                    <th className="pl-5">Line</th>
                    <th>Reason</th>
                    <th className="num">Engine</th>
                    <th className="num">Working</th>
                    <th className="num pr-5">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {eff.adjustments.map((a) => (
                    <tr key={a.factId}>
                      <td className="pl-5">
                        <RefLink refId={a.key} href={lineHref(a.key)} />
                      </td>
                      <td className="max-w-[360px]">
                        <div className="line-clamp-2 text-[12.5px] leading-4">{a.reason}</div>
                        <div className="text-[11px] text-muted">
                          {a.actorName}
                          {a.requiresPartner ? " · partner approval" : ""}
                        </div>
                      </td>
                      <td className="num text-muted">{fmtNumber(a.engineValue)}</td>
                      <td className="num font-semibold">{fmtNumber(a.newValue)}</td>
                      <td className={cn("num pr-5 font-medium", a.delta > 0 ? "text-warn" : a.delta < 0 ? "text-ok" : "text-muted")}>{(a.delta > 0 ? "+" : "") + fmtNumber(a.delta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card title="Signatures" description="Both spouses sign a joint return. A signature is valid only while the return's fingerprint matches the one they signed.">
            <ul className="grid gap-3">
              {client.signers.map((s) => (
                <li key={s.actorId} className="flex items-start gap-3">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold", s.state === "valid" ? "bg-ok-soft text-ok" : s.state === "reopened" ? "bg-warn-soft text-warn" : "bg-surface-2 text-muted")}>{initials(s.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium">{s.name}</span>
                      <Badge tone={STEP_TONE[s.state === "valid" ? "done" : s.state === "reopened" ? "stale" : "todo"]} dot>
                        {s.state === "valid" ? "signed" : s.state === "reopened" ? "reopened" : "not signed"}
                      </Badge>
                    </div>
                    {s.approval ? (
                      <div className="mt-0.5 text-[11.5px] leading-4 text-muted">
                        {fmtDateTime(s.approval.at)} · as {String(s.approval.body.signerName)} · PIN ···{String(s.approval.body.pinHint)}
                        <br />
                        on {String(s.approval.body.version)}
                        {Number(s.approval.body.adjustments) ? " + " + String(s.approval.body.adjustments) + " adj." : ""} · federal {fmtBalance(Number(s.approval.body.federalBalance))}, CA {fmtBalance(Number(s.approval.body.californiaBalance))}
                      </div>
                    ) : (
                      <div className="mt-0.5 text-[11.5px] text-muted">{client.requestCurrent ? "has the request; nothing signed yet" : "nothing to sign until the return is sent"}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="History" description="Every request and signature on this return, newest first." flush>
            {history.length === 0 ? (
              <div className="p-5">
                <Empty>Nothing sent yet.</Empty>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {history.map((h) => {
                  const current = h.body.hash === ctx.returnHash;
                  return (
                    <li key={h.id} className={cn("flex items-start gap-3 px-5 py-2.5", h.retracted && "opacity-60")}>
                      <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset", h.kind === "approval" ? "bg-ok-soft text-ok ring-ok/20" : "bg-accent-soft text-accent ring-accent/25")}>{h.kind === "approval" ? <FileSignature className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]">
                          <span className="font-medium">{h.kind === "approval" ? String(h.body.signerName) + " signed" : "Sent by " + h.actorName}</span>
                          <Badge tone={current ? "ok" : "neutral"}>{current ? "this return" : "earlier return"}</Badge>
                        </div>
                        <div className="text-[11.5px] leading-4 text-muted">
                          {fmtDateTime(h.at)}
                          {h.kind === "approval" ? " · federal " + fmtBalance(Number(h.body.federalBalance)) + ", CA " + fmtBalance(Number(h.body.californiaBalance)) : h.body.message ? " · “" + String(h.body.message).slice(0, 80) + (String(h.body.message).length > 80 ? "…" : "") + "”" : ""}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="flex items-start gap-2 px-1 text-[11.5px] leading-4 text-muted">
            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <span>Once both signatures are current, the return transmits from Filing. The approval is part of the record the firm keeps for three years.</span>
          </div>
        </div>
      </div>
    </>
  );
}
