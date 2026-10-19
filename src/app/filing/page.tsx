import { Check, CheckCircle2, FileWarning, OctagonAlert, RefreshCw, Send, ShieldAlert, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/filing/action-form";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, cn, Empty, KV, Stat, type Tone } from "@/components/ui";
import { acknowledgeAction, correctionAction, extensionAction, openAmendmentAction, transmitAction } from "@/lib/facts/actions-filing";
import { fmtBalance, fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { maskSsn } from "@/lib/mask";
import { canAmend, canCorrectIdentity, canFile } from "@/lib/permissions";
import { documentHref, lineHref } from "@/lib/refs";
import { getReviewContext } from "@/lib/review";
import { FILED_LINE_KEYS, FILED_LINE_LABELS, JURISDICTION_LABELS, JURISDICTIONS, latePaymentEstimate, PHASE_LABELS, type FilingPhase, type Transmission, type TransmissionStatus } from "@/lib/season";
import { getCurrentActor, getNow } from "@/lib/session";
import { staffOnlyPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Filing" };

const STATUS_TONE: Record<TransmissionStatus, Tone> = { transmitted: "accent", accepted: "ok", rejected: "danger", held: "warn" };
const PHASE_TONE: Record<FilingPhase, Tone> = { preparing: "neutral", transmitted: "accent", rejected: "danger", filed: "ok", amending: "warn", amended: "ok" };

export default async function FilingPage() {
  await staffOnlyPage();
  const actor = await getCurrentActor();
  const ctx = await getReviewContext();
  const now = await getNow();
  const { filing, identity, packet, eff } = ctx;
  const ok = ctx.gates.filter((g) => g.ok).length;
  const ready = ok === ctx.gates.length;
  const deadlines = packet.firm.deadlines.filter((d) => /due date/i.test(d.what) && !/outside engagement/i.test(d.what)).slice(0, 2);
  const journey: { key: string; label: string; done: boolean; current: boolean; tone: Tone }[] = (() => {
    const order = ["preparing", "transmitted", "acknowledged", "filed", "amended"] as const;
    const at = filing.phase === "preparing" ? 0 : filing.phase === "transmitted" ? 1 : filing.phase === "rejected" ? 2 : filing.phase === "filed" ? 3 : 4;
    const labels: Record<(typeof order)[number], string> = { preparing: "Prepare and sign", transmitted: "Transmit", acknowledged: filing.phase === "rejected" ? "Rejected" : "Acknowledged", filed: "Filed", amended: filing.phase === "amending" ? "Amending" : "Amended" };
    return order.map((k, i) => ({ key: k, label: labels[k], done: i < at, current: i === at, tone: (k === "acknowledged" && filing.phase === "rejected" ? "danger" : i <= at ? "accent" : "neutral") as Tone }));
  })();
  const extRef = packet.what_if.extension as Record<string, unknown>;
  const rates = packet.post_filing_rates as Record<string, unknown>;
  const mayFile = canFile(actor);
  const uncorrected = identity.filter((m) => !m.correction);
  const inFlight = [filing.federal.current, filing.california.current].some((t) => t && (t.status === "transmitted" || t.status === "held"));
  const rejected = [filing.federal.current, filing.california.current].filter((t): t is Transmission => Boolean(t && t.status === "rejected"));
  const asFiled = filing.asFiled;
  const filedLines = (asFiled?.fact.body.lines ?? {}) as Record<string, number | string>;
  const amendRows = asFiled
    ? FILED_LINE_KEYS.map((k) => ({ key: k, a: filedLines[k], c: eff.value(k) })).filter((r) => r.a !== undefined && r.c !== undefined && r.a !== r.c)
    : [];
  const amendmentLayer = eff.adjustments.filter((a) => a.seq > (filing.amendmentFromSeq ?? Number.MAX_SAFE_INTEGER));
  const originalDue = deadlines.find((d) => /original/i.test(d.what))?.date ?? "2026-04-15";
  const fedAccepted = filing.federal.accepted;
  const fedBalance = fedAccepted ? Number((fedAccepted.fact.body.summary as { balance_due: number }).balance_due) : null;
  const late = fedAccepted && fedBalance !== null && fedBalance > 0 ? latePaymentEstimate(fedBalance, originalDue, (fedAccepted.ack?.body.agencyDate as string | undefined) ?? now.iso, { interestAnnual: Number(rates.irs_underpayment_interest_rate_annual ?? 0.07), penaltyPerMonth: Number(rates.irs_failure_to_pay_penalty_per_month ?? 0.005) }) : null;

  const transmissions = [...filing.federal.transmissions, ...filing.california.transmissions].sort((a, b) => a.fact.seq - b.fact.seq);

  return (
    <>
      <PageHeader
        eyebrow="Filing"
        title="File and amend"
        description="From the extension to the acknowledgment and beyond. Every gate the firm puts between a prepared return and a filed one is computed; the transmission freezes the return; the agency's answer is simulated from the data exactly as the real e-file system would answer it."
        meta={
          <>
            <Badge tone={PHASE_TONE[filing.phase]} dot>
              {PHASE_LABELS[filing.phase]}
            </Badge>
            {ready ? (
              <Badge tone="ok" dot>
                all gates open
              </Badge>
            ) : (
              <Badge tone="danger" dot>
                {ctx.gates.length - ok} gate{ctx.gates.length - ok === 1 ? "" : "s"} closed
              </Badge>
            )}
            {filing.frozen ? <Badge tone="warn">return frozen</Badge> : null}
          </>
        }
      />

      <ol className="card mb-4 grid grid-cols-5 divide-x divide-border overflow-hidden">
        {journey.map((j, i) => (
          <li key={j.key} className={cn("flex items-center gap-3 px-4 py-3", j.current && "bg-accent-soft/40")}>
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ring-1 ring-inset", j.done ? "bg-ok-soft text-ok ring-ok/25" : j.current ? (j.tone === "danger" ? "bg-danger-soft text-danger ring-danger/25" : "bg-accent text-accent-fg ring-accent") : "bg-surface-2 text-muted ring-border")}>{j.done ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
            <span className="min-w-0">
              <span className={cn("block truncate text-[12.5px] font-medium", !j.done && !j.current && "text-muted")}>{j.label}</span>
              {j.current ? <span className="block text-[10.5px] uppercase tracking-[0.06em] text-muted">now</span> : null}
            </span>
          </li>
        ))}
      </ol>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Gates open" value={ok + " / " + ctx.gates.length} tone={ready ? "ok" : "danger"} hint={ready ? "ready to transmit" : ctx.gates.length - ok + " still closed"} />
        <Stat label="Working return" value={eff.version + (eff.adjustments.length ? " +" + eff.adjustments.length : "")} hint="version plus adjustments" />
        {deadlines.map((d) => (
          <Stat key={d.what} label={d.what.replace(/ - /, " · ")} value={fmtDate(d.date)} />
        ))}
      </div>

      {rejected.length ? (
        <Card className="mt-4 border-danger/40" title={<span className="flex items-center gap-2 text-danger"><OctagonAlert className="h-4 w-4" /> E-file rejected</span>} description="The return is unfrozen so the cause can be fixed. Fix it below, then retransmit; a rejection is not a filing.">
          <ul className="grid gap-2 text-[13px]">
            {rejected.flatMap((t) =>
              t.errors.map((e) => (
                <li key={t.fact.id + e.code} className="flex items-start gap-2">
                  <Badge tone="danger" mono>
                    {e.code}
                  </Badge>
                  <span>
                    <span className="capitalize">{t.jurisdiction}</span>: {e.message}
                  </span>
                </li>
              )),
            )}
          </ul>
        </Card>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card
          title="Filing gates"
          description="None can be ticked by hand. Each is computed from the ledger and the firm's standards."
          className="xl:col-span-2"
          aside={
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                <span className={cn("block h-full rounded-full", ready ? "bg-ok" : "bg-accent")} style={{ width: Math.round((ok / ctx.gates.length) * 100) + "%" }} />
              </span>
              <span className="tabular-nums">
                {ok} / {ctx.gates.length}
              </span>
            </span>
          }
          flush
        >
          <ul className="divide-y divide-border">
            {ctx.gates.map((g, i) => (
              <li key={g.id} className={cn("flex items-start gap-3 px-5 py-3", !g.ok && "bg-danger-soft/10")}>
                <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", g.ok ? "bg-ok-soft text-ok ring-ok/25" : "bg-danger-soft text-danger ring-danger/25")}>{g.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <OctagonAlert className="h-3.5 w-3.5" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    <span className="font-mono text-[10.5px] text-muted">{i + 1}</span>
                    {g.label}
                  </div>
                  <p className="mt-0.5 text-[12px] leading-5 text-muted">{g.detail}</p>
                </div>
                <Link href={g.href} className="pill h-7 px-2.5 text-[12px]">
                  open
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card id="identity" title={<span className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-warn" /> Identity data vs documents</span>} description="Hand-entered identifiers checked against identity documents in the file. The e-file database makes the same comparison.">
          {identity.length === 0 ? (
            <Empty>Every identifier entered agrees with the documents in the file.</Empty>
          ) : (
            <ul className="grid gap-3 text-[13px]">
              {identity.map((m) => (
                <li key={m.personId + m.field} className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{m.name}</span>
                    <Badge tone={m.correction ? "ok" : "danger"}>{m.correction ? "corrected" : m.field.toUpperCase() + " differs"}</Badge>
                  </div>
                  <div className="text-[12px] text-muted">
                    Entered <span className="font-mono">{maskSsn(m.entered)}</span> · on <RefLink refId={m.documentId} href={documentHref(m.documentId)} /> <span className="font-mono">{maskSsn(m.onDocument)}</span>
                  </div>
                  {m.correction ? (
                    <div className="text-[12px] text-muted">
                      Corrected by {m.correction.actorName} · {fmtDateTime(m.correction.at)} · from <RefLink refId={m.evidence} />
                    </div>
                  ) : canCorrectIdentity(actor) ? (
                    <ActionForm action={correctionAction} hidden={{ person: m.personId, field: m.field, evidence: m.evidence }} label={"Correct from " + m.documentId} icon={<RefreshCw className="h-3.5 w-3.5" />} fields={[{ name: "text", label: "Note", type: "textarea", placeholder: "Client confirmed the card; number was mistyped at intake." }]} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {JURISDICTIONS.map((j) => {
          const ref = extRef[j] as Record<string, number> | undefined;
          const ext = filing[j].extension;
          const form = j === "federal" ? "Form 4868" : "FTB 3519";
          return (
            <Card key={j} title={JURISDICTION_LABELS[j] + " extension"} description={"An extension of time to file is not an extension of time to pay. The payment was sized from " + String(extRef.based_on_version ?? "the return") + " on " + fmtDate(String(ref ? extRef.computed_at : ""))}>
              <KV
                rows={[
                  ["Estimated total tax", ref ? fmtMoney(ref.estimated_total_tax) : "—"],
                  ["Payments so far", ref ? fmtMoney(ref.payments) : "—"],
                  ["Estimated balance", ref ? fmtBalance(ref.estimated_balance) : "—"],
                  ["Rule", String(ref?.rule ?? "")],
                ]}
              />
              <div className="mt-3 border-t border-border pt-3">
                {ext ? (
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <Badge tone="ok" dot>
                      {String(ext.body.form)} filed
                    </Badge>
                    <span>
                      paid {fmtMoney(Number(ext.body.payment))} · {ext.actorName} · {fmtDateTime(ext.at)}
                    </span>
                  </div>
                ) : filing[j].current ? (
                  <span className="text-[12px] text-muted">No extension recorded before transmission.</span>
                ) : (
                  <ActionForm
                    action={extensionAction}
                    hidden={{ jurisdiction: j }}
                    label={"Record " + form + " with payment"}
                    icon={<Send className="h-3.5 w-3.5" />}
                    disabled={!mayFile}
                    disabledReason="Preparer-and-above records the extension."
                    fields={[
                      { name: "payment", label: "Payment sent with the extension", type: "number", defaultValue: ref ? String(j === "federal" ? ref.paid_with_form_4868 : ref.paid_with_ftb_3519) : "0", required: true, hint: ref ? "Suggested: balance rounded up to the next 500" : undefined },
                      { name: "text", label: "Note", type: "textarea", placeholder: "Confirmation number, how it was paid." },
                    ]}
                  />
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4" title="Transmission" description="One transmission sends both returns. The return freezes until the agencies answer; a rejection unfreezes it, an acceptance keeps it frozen until an amendment is opened." flush>
        {transmissions.length ? (
          <table className="tbl">
            <thead>
              <tr>
                <th>Jurisdiction</th>
                <th>Kind</th>
                <th>Submission id</th>
                <th>Transmitted</th>
                <th>Return</th>
                <th>Status</th>
                <th>Acknowledged</th>
              </tr>
            </thead>
            <tbody>
              {transmissions.map((t) => (
                <tr key={t.fact.id}>
                  <td className="capitalize">{t.jurisdiction}</td>
                  <td>{t.kind}</td>
                  <td className="font-mono text-[11.5px]">{t.submissionId}</td>
                  <td className="whitespace-nowrap text-muted">
                    {fmtDateTime(t.fact.at)} · {t.fact.actorName}
                  </td>
                  <td className="text-muted">
                    {String(t.fact.body.version)}
                    {Number(t.fact.body.adjustments) ? " +" + String(t.fact.body.adjustments) : ""} · <span className="font-mono text-[10.5px]">{String(t.fact.body.hash).slice(0, 10)}</span>
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[t.status]} dot>
                      {t.status}
                    </Badge>
                  </td>
                  <td className="text-muted">
                    {t.ack ? fmtDateTime(String(t.ack.body.agencyDate)) : "—"}
                    {t.errors.length ? <div className="text-[11.5px] text-danger">{t.errors.map((e) => e.code).join(", ")}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-3">
            <Empty>Nothing transmitted yet.</Empty>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
          {inFlight ? (
            <ActionForm action={acknowledgeAction} label="Pick up acknowledgments" icon={<RefreshCw className="h-3.5 w-3.5" />} primary disabled={actor.kind !== "staff"} disabledReason="Staff pick up acknowledgments." />
          ) : filing.amendment ? (
            <ActionForm
              action={transmitAction}
              hidden={{ kind: "amended" }}
              label="Transmit amended return (federal and California)"
              icon={<Send className="h-3.5 w-3.5" />}
              primary
              confirm="Transmit the amended return to both agencies? The return freezes again until they answer."
              disabled={!mayFile || !ready || amendmentLayer.length === 0}
              disabledReason={!mayFile ? "Preparer-and-above transmits." : amendmentLayer.length === 0 ? "Make the correcting adjustments first; nothing differs from the return of record yet." : "Every gate must be open again: the changes reopened the sign-offs and the client approval."}
            />
          ) : asFiled ? (
            <span className="text-[12.5px] text-muted">Return of record accepted. To change anything, open an amendment below.</span>
          ) : (
            <ActionForm
              action={transmitAction}
              hidden={{ kind: "original" }}
              label="Transmit federal and California returns"
              icon={<Send className="h-3.5 w-3.5" />}
              primary
              confirm="Transmit both returns now? The return freezes until the agencies acknowledge."
              disabled={!mayFile || !ready}
              disabledReason={!mayFile ? "Preparer-and-above transmits." : "Open every filing gate first."}
            />
          )}
          {uncorrected.length && !asFiled ? (
            <span className="flex items-center gap-1.5 text-[12px] text-warn">
              <FileWarning className="h-3.5 w-3.5" /> {uncorrected.length} identity mismatch{uncorrected.length === 1 ? "" : "es"} uncorrected: the IRS will reject with R0000-504-02.
            </span>
          ) : null}
        </div>
      </Card>

      {asFiled ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card title="After acceptance" description="What the agencies do next, and what the engine leaves to people.">
            <KV
              rows={[
                ["Federal return of record", String(asFiled.fact.body.version) + (Number(asFiled.fact.body.adjustments) ? " +" + String(asFiled.fact.body.adjustments) + " adjustments" : "") + " · accepted " + (asFiled.ack ? fmtDate(String(asFiled.ack.body.agencyDate)) : "")],
                ["Federal balance as filed", fedBalance !== null ? fmtBalance(fedBalance) : "—"],
                ["California balance as filed", filing.california.accepted ? fmtBalance(Number((filing.california.accepted.fact.body.summary as { balance_due: number }).balance_due)) : "—"],
              ]}
            />
            {late ? (
              <div className="mt-3 rounded-lg border border-warn/30 bg-warn-soft p-3 text-[12.5px]">
                <div className="font-medium text-warn">Paid after the original due date</div>
                <p className="mt-1 text-muted">
                  {fmtMoney(late.balance)} due {fmtDate(late.dueDate)}, paid {fmtDate(late.paidDate)}: {late.days} days late. Estimated interest {fmtMoney(late.interest)} at {Math.round(late.interest / late.balance / (late.days / 365) * 1000) / 10}% and failure-to-pay penalty {fmtMoney(late.penalty)} ({late.months} month{late.months === 1 ? "" : "s"} × 0.5%), about {fmtMoney(late.total)} in all. The IRS computes the actual figures; the extension did not extend the time to pay.
                </p>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2 text-[12.5px]">
              <Link href="/client-copy" className="pill h-7 px-2.5 text-[12px]">
                Client copy
              </Link>
              <Link href="/next-year" className="pill h-7 px-2.5 text-[12px]">
                Carry forward to {packet.household.tax_year + 1}
              </Link>
            </div>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><Undo2 className="h-4 w-4" /> Amended return (Form 1040-X / Schedule X)</span>}
            description={filing.amendment ? "Amendment open since " + fmtDateTime(filing.amendment.at) + " by " + filing.amendment.actorName + ": " + String(filing.amendment.body.reason) : "An amendment unfreezes the numbers. Every change after the return of record becomes a column on Form 1040-X."}
          >
            {filing.amendment || filing.phase === "amended" ? (
              amendRows.length ? (
                <table className="tbl text-[12.5px]">
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th className="text-right">A · as filed</th>
                      <th className="text-right">B · change</th>
                      <th className="text-right">C · corrected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {amendRows.map((r) => (
                      <tr key={r.key}>
                        <td>
                          <Link href={lineHref(r.key)} className="hover:underline">
                            {FILED_LINE_LABELS[r.key] ?? r.key}
                          </Link>
                          <div className="font-mono text-[10.5px] text-muted">{r.key}</div>
                        </td>
                        <td className="text-right tabular-nums">{typeof r.a === "number" ? fmtMoney(r.a) : String(r.a)}</td>
                        <td className="text-right tabular-nums">{typeof r.a === "number" && typeof r.c === "number" ? (r.c - r.a > 0 ? "+" : "") + fmtMoney(r.c - r.a) : "—"}</td>
                        <td className="text-right tabular-nums font-medium">{typeof r.c === "number" ? fmtMoney(r.c) : String(r.c)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Empty>No line differs from the return of record yet. Make the correcting adjustments on the return; they appear here.</Empty>
              )
            ) : null}
            {filing.amendment && amendmentLayer.length ? (
              <ul className="mt-3 grid gap-1 text-[12.5px] text-muted">
                {amendmentLayer.map((a) => (
                  <li key={a.factId}>
                    <Link href={lineHref(a.key)} className="font-mono text-[11.5px] text-foreground hover:underline">
                      {a.key}
                    </Link>{" "}
                    {fmtMoney(a.engineValue)} → {fmtMoney(a.newValue)} · {a.reason}
                  </li>
                ))}
              </ul>
            ) : null}
            {!filing.amendment && filing.phase !== "transmitted" ? (
              <div className="mt-3">
                <ActionForm action={openAmendmentAction} label="Open an amendment" icon={<Undo2 className="h-3.5 w-3.5" />} disabled={!canAmend(actor)} disabledReason="A reviewer or partner opens an amendment." fields={[{ name: "reason", label: "Why the return of record is wrong", type: "textarea", required: true, placeholder: "Schedule C receipts counted the Form 1099-K deposits twice; refund due." }]} />
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
    </>
  );
}
