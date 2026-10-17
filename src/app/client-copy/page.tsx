import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { Badge, cn } from "@/components/ui";
import { filingStatusLabel, fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { maskAccount, maskSsn } from "@/lib/mask";
import { getReviewContext } from "@/lib/review";
import { carryforwardRows, FILED_LINE_KEYS, FILED_LINE_LABELS, PHASE_LABELS } from "@/lib/season";
import { logSensitiveView } from "@/lib/sensitive";
import { getViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Client copy" };

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-border px-8 py-6 first:border-t-0 sm:px-10", className)}>
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-border/70 py-1.5 last:border-b-0">
      <span className="text-[12.5px] text-muted">{k}</span>
      <span className="text-right text-[13px]">{v}</span>
    </div>
  );
}

/**
 * The client's copy of the return: what was filed (or, before filing, the
 * draft), what it means, how it was signed and transmitted, and what to keep.
 * Laid out as a document so it prints as one. Sensitive identifiers stay
 * masked unless the viewer is cleared and has reveal on.
 */
export default async function ClientCopyPage() {
  const { actor, reveal } = await getViewer();
  const ctx = await getReviewContext();
  const { packet, filing, eff } = ctx;
  const asFiled = filing.asFiled;
  const filed = Boolean(asFiled);
  const fedLines = (asFiled?.fact.body.lines ?? {}) as Record<string, number | string>;
  const value = (k: string) => (filed ? fedLines[k] : eff.value(k));
  const fedSummary = filed ? (asFiled!.fact.body.summary as { total_tax: number; payments: number; balance_due: number }) : eff.workingSummary.federal;
  const caT = filing.california.accepted;
  const caSummary = caT ? (caT.fact.body.summary as { total_tax: number; payments: number; balance_due: number }) : eff.workingSummary.california;
  const approvals = (ctx.ledger.byTarget.get("return") ?? []).filter((f) => f.kind === "approval" && !f.retracted);
  const transmissions = [...filing.federal.transmissions, ...filing.california.transmissions].filter((t) => t.status === "accepted" || t.status === "transmitted");
  const bank = packet.household.bank_account_for_refund_or_payment;
  const home = packet.household.addresses.find((a) => a.to === null) ?? packet.household.addresses.at(-1);
  const carry = carryforwardRows(packet, ctx.index).filter((r) => typeof r.value === "number" && r.value !== 0);
  const identity = packet.firm.firm_identity as Record<string, unknown>;
  const signer = packet.firm.staff.find((s) => s.id === identity.paid_preparer_signing_returns);
  const show = (s: string) => (reveal ? s : maskSsn(s));
  if (reveal) logSensitiveView(actor, "client-copy", [...packet.household.people.filter((p) => p.ssn).map((p) => "ssn:" + p.id), "bank_account"]);
  const groups: [string, string[]][] = [
    ["Income", ["F1040.1a", "SchC.1", "SchC.31", "SchD.16", "F1040.9"]],
    ["Deductions and taxable income", ["F1040.10", "F1040.11", "SchA.14", "SchA.17", "F1040.12", "F1040.15"]],
    ["Tax and payments", ["F1040.16", "F1040.24", "F1040.25d", "F1040.26", "F1040.33", "F1040.38", "F1040.37"]],
    ["California", ["F540NR.17", "F540NR.32", "F540NR.35", "F540NR.64", "F540NR.78", "F540NR.97"]],
  ];
  const taxpayers = packet.household.people.filter((p) => p.role !== "dependent");
  const dependents = packet.household.people.filter((p) => p.role === "dependent");
  const originalDue = packet.firm.deadlines.find((d) => /original/i.test(d.what))?.date ?? "";
  const versionLabel = filed ? String(asFiled!.fact.body.version) : eff.version;

  return (
    <>
      <PageHeader
        eyebrow="Filing"
        title="Client copy"
        description={filed ? "The returns as filed and accepted, laid out for the household to keep." : "A draft of the household's copy. It becomes the client copy when the return is filed and accepted."}
        meta={
          <>
            <Badge tone={filed ? "ok" : "warn"} dot>
              {filed ? "as filed" : "draft · " + PHASE_LABELS[filing.phase].toLowerCase()}
            </Badge>
            <Badge tone="neutral" mono>
              {versionLabel}
            </Badge>
            {!reveal ? <Badge>identifiers masked</Badge> : null}
          </>
        }
        actions={<PrintButton />}
        className="print:hidden"
      />

      <article className="card relative mx-auto max-w-[920px] overflow-hidden print:max-w-none print:border-0 print:shadow-none">
        {!filed ? (
          <div className="pointer-events-none absolute right-10 top-[92px] rotate-[-8deg] rounded-md border-2 border-warn/50 px-3 py-1 text-[13px] font-bold uppercase tracking-[0.2em] text-warn/70 print:hidden">Draft</div>
        ) : null}

        <header className="px-8 pb-6 pt-8 sm:px-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="brand-mark flex h-9 w-9 items-center justify-center rounded-lg text-[14px] font-bold text-white">{packet.firm.name.slice(0, 1)}</span>
              <div className="leading-tight">
                <div className="text-[14px] font-semibold tracking-[-0.01em]">{packet.firm.name}</div>
                <div className="text-[12px] text-muted">
                  {String(identity.address ?? "")}
                  {identity.phone ? " · " + String(identity.phone) : ""}
                </div>
              </div>
            </div>
            <div className="text-right text-[12px] text-muted">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em]">Client copy</div>
              <div>Tax year {packet.household.tax_year}</div>
              <div>{filed ? "Filed " + (asFiled!.ack ? fmtDate(String(asFiled!.ack.body.agencyDate)) : "") : "Prepared " + fmtDate(new Date().toISOString())}</div>
            </div>
          </div>
          <h1 className="mt-8 text-[28px] font-semibold leading-9 tracking-[-0.02em]">
            {taxpayers.map((p) => p.name).join(" and ")}
            <span className="block text-[18px] font-normal text-muted">Your {packet.household.tax_year} federal and California income tax returns</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-6 text-muted">
            {filed ? "This is the copy of your returns as transmitted and accepted. Keep it with the documents listed at the end; you will need it for next year and for any letter from a tax agency." : "This is your return as it stands in the workpaper today. Figures can still change until your preparer files it."}
          </p>
        </header>

        <Section title="The result in one glance" className="bg-surface-2/40">
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["Federal (IRS)", fedSummary],
                ["California (FTB)", caSummary],
              ] as const
            ).map(([label, s]) => (
              <div key={label} className="rounded-xl border border-border bg-surface p-4 shadow-[var(--card-inset)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className={cn("text-[30px] font-semibold leading-none tabular-nums tracking-[-0.02em]", s.balance_due < 0 && "text-ok")}>{fmtMoney(Math.abs(s.balance_due))}</span>
                  <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">{s.balance_due < 0 ? "refund to you" : "you owe"}</span>
                </div>
                <div className="mt-3">
                  <Row k="Total tax" v={<span className="tabular-nums">{fmtMoney(s.total_tax)}</span>} />
                  <Row k="Payments and credits" v={<span className="tabular-nums">{fmtMoney(s.payments)}</span>} />
                  <Row k={s.balance_due >= 0 ? "Balance due" : "Overpaid"} v={<span className="font-semibold tabular-nums">{fmtMoney(Math.abs(s.balance_due))}</span>} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12.5px] leading-5 text-muted">
            {fedSummary.balance_due > 0 ? "The federal balance is paid by direct debit from the account below. A balance paid after " + fmtDate(originalDue) + " carries interest and a late-payment penalty computed by the IRS, even though the filing deadline was extended. " : ""}
            {caSummary.balance_due < 0 ? "The California refund is deposited to the same account." : ""}
          </p>
          <Row k="Account for payment and refund" v={bank.bank + " · " + bank.type + " · " + (reveal ? bank.account : maskAccount(bank.account))} />
        </Section>

        <Section title="Who this return is for">
          <div className="grid gap-x-10 gap-y-1 sm:grid-cols-2">
            <div>
              <Row k="Taxpayers" v={taxpayers.map((p) => p.name).join(" and ")} />
              <Row k="Filing status" v={filingStatusLabel(packet.household.filing_status)} />
              <Row k="Home address" v={home?.address ?? ""} />
              <Row k="Dependents" v={dependents.map((p) => p.name).join(", ") || "none"} />
            </div>
            <div>
              {packet.household.people.map((p) => (
                <Row key={p.id} k={p.name + " SSN"} v={<span className="font-mono text-[12px]">{p.ssn ? show(p.ssn) : "—"}</span>} />
              ))}
              <Row k="Residency" v={packet.household.residency.map((r) => r.state + " " + fmtDate(r.from) + " to " + fmtDate(r.to)).join("; ")} />
            </div>
          </div>
        </Section>

        <Section title="Key lines of the returns">
          <p className="mb-3 text-[12.5px] text-muted">{filed ? "Values as transmitted. Form and line references follow the IRS and FTB forms." : "Working values today. They can still change until the return is filed."}</p>
          <table className="w-full text-[13px]">
            <tbody>
              {groups.map(([group, keys]) => (
                <Fragment key={group}>
                  <tr>
                    <td colSpan={3} className="pb-1.5 pt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                      {group}
                    </td>
                  </tr>
                  {keys
                    .filter((k) => FILED_LINE_KEYS.includes(k) && value(k) !== undefined)
                    .map((k) => {
                      const v = value(k)!;
                      const total = /^(F1040\.(9|11|15|24|33|37)|F540NR\.(64|78|97))$/.test(k);
                      return (
                        <tr key={k} className={cn("border-b border-dashed border-border/70", total && "font-semibold")}>
                          <td className="py-1.5">{FILED_LINE_LABELS[k] ?? k}</td>
                          <td className="py-1.5 font-mono text-[10.5px] font-normal text-muted">{k}</td>
                          <td className="py-1.5 text-right tabular-nums">{typeof v === "number" ? fmtMoney(v) : String(v)}</td>
                        </tr>
                      );
                    })}
                </Fragment>
              ))}
            </tbody>
          </table>
          {!filed && eff.adjustments.length ? (
            <p className="mt-3 text-[12px] leading-5 text-muted">
              Tax, penalty and balance lines are the engine&apos;s from {eff.version}; the result above adds the estimated effect of {eff.adjustments.length} working adjustment{eff.adjustments.length === 1 ? "" : "s"} that the engine has not recomputed yet.
            </p>
          ) : null}
        </Section>

        <Section title="Signatures and transmission">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              {approvals.length ? (
                <ul className="grid gap-2 text-[13px]">
                  {approvals.map((a) => (
                    <li key={a.id} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                      <span>
                        <span className="font-medium">{String(a.body.signerName)}</span> signed Form 8879 and FTB 8879 electronically on {fmtDateTime(a.at)} with a self-selected PIN ending {String(a.body.pinHint)}.
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">Not yet signed. Your preparer sends the return for your approval when review is complete.</p>
              )}
              <div className="mt-4 text-[13px]">
                {transmissions.length ? (
                  <ul className="grid gap-1.5">
                    {transmissions.map((t) => (
                      <li key={t.fact.id}>
                        <span className="capitalize">{t.jurisdiction}</span> {t.kind === "amended" ? "amended " : ""}return · submission <span className="font-mono text-[11.5px]">{t.submissionId}</span> · {t.status}
                        {t.ack ? " " + fmtDate(String(t.ack.body.agencyDate)) : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted">Not yet transmitted.</span>
                )}
              </div>
            </div>
            <div>
              <Row k="Paid preparer" v={signer ? signer.name + " · PTIN " + String((identity.ptins as Record<string, string>)?.[signer.id] ?? "") : "—"} />
              <Row k="Firm" v={packet.firm.name + " · EIN " + String(identity.ein ?? "")} />
              <Row k="Electronic return originator" v={"EFIN " + String(identity.efin ?? "")} />
            </div>
          </div>
        </Section>

        <Section title={"What carries into " + (packet.household.tax_year + 1)}>
          {carry.length ? (
            <div className="grid gap-x-10 sm:grid-cols-2">
              {carry.map((r) => (
                <Row key={r.id} k={r.label + " (" + r.jurisdiction + ")"} v={<span className="tabular-nums">{typeof r.value === "number" ? fmtMoney(r.value) : String(r.value)}</span>} />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted">Nothing carries forward.</p>
          )}
          <p className="mt-4 text-[12.5px] leading-5 text-muted">Keep: Forms W-2, 1099, K-1 and 1098 for this year, the donation acknowledgments, the closing statements for the home sale and purchase, and this copy, for at least three years after filing; the basis records for the S corporation, the partnership and the home for as long as you own them.</p>
          {actor.kind === "staff" ? (
            <Link href="/next-year" className="mt-3 inline-block text-[12px] text-accent hover:underline print:hidden">
              Carry forward and plan
            </Link>
          ) : null}
        </Section>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-2/40 px-8 py-3 text-[11px] text-muted sm:px-10">
          <span>
            {packet.firm.name} · {String(identity.address ?? "")}
          </span>
          <span>
            {packet.packet.client_id} · {versionLabel} · {filed ? "as filed" : "draft"}
          </span>
        </footer>
      </article>
    </>
  );
}
