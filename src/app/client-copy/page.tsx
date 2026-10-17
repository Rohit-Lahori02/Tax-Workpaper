import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { Badge, Card, KV } from "@/components/ui";
import { filingStatusLabel, fmtBalance, fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { maskAccount, maskSsn } from "@/lib/mask";
import { getReviewContext } from "@/lib/review";
import { carryforwardRows, FILED_LINE_KEYS, FILED_LINE_LABELS, PHASE_LABELS } from "@/lib/season";
import { logSensitiveView } from "@/lib/sensitive";
import { getViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Client copy" };

/**
 * The client's copy of the return: what was filed (or, before filing, the
 * draft), what it means, how it was signed and transmitted, and what to keep.
 * Printable. Sensitive identifiers stay masked unless the viewer is cleared
 * and has reveal on.
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

  return (
    <>
      <PageHeader
        eyebrow={packet.firm.name + " · " + String(identity.address ?? "")}
        title={"Your " + packet.household.tax_year + " income tax returns"}
        description={filed ? "This is the copy of the returns as filed and accepted. Keep it with the documents listed at the end." : "Draft. This is the return as it stands in the workpaper today; it becomes your copy when it is filed and accepted."}
        meta={
          <>
            <Badge tone={filed ? "ok" : "warn"} dot>
              {filed ? "as filed" : "draft · " + PHASE_LABELS[filing.phase].toLowerCase()}
            </Badge>
            <Badge tone="neutral">{filed ? String(asFiled!.fact.body.version) : eff.version}</Badge>
          </>
        }
        actions={<PrintButton />}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Who this return is for">
          <KV
            rows={[
              ["Taxpayers", packet.household.people.filter((p) => p.role !== "dependent").map((p) => p.name).join(" and ")],
              ["Filing status", filingStatusLabel(packet.household.filing_status)],
              ["Home address", home?.address ?? ""],
              ["Dependents", packet.household.people.filter((p) => p.role === "dependent").map((p) => p.name).join(", ") || "none"],
              ...packet.household.people.map((p) => [p.name + " SSN", p.ssn ? show(p.ssn) : "—"] as [string, string]),
              ["Residency", packet.household.residency.map((r) => r.state + " " + fmtDate(r.from) + " to " + fmtDate(r.to) + " (" + r.status + ")").join("; ")],
            ]}
          />
        </Card>

        <Card title="The result in one glance" className="xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Federal (IRS)</div>
              <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-tight">{fmtBalance(fedSummary.balance_due)}</div>
              <KV className="mt-2" rows={[["Total tax", fmtMoney(fedSummary.total_tax)], ["Payments and credits", fmtMoney(fedSummary.payments)], [fedSummary.balance_due >= 0 ? "You owe" : "Refund", fmtMoney(Math.abs(fedSummary.balance_due))]]} />
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">California (FTB)</div>
              <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-tight">{fmtBalance(caSummary.balance_due)}</div>
              <KV className="mt-2" rows={[["Total tax", fmtMoney(caSummary.total_tax)], ["Payments and credits", fmtMoney(caSummary.payments)], [caSummary.balance_due >= 0 ? "You owe" : "Refund", fmtMoney(Math.abs(caSummary.balance_due))]]} />
            </div>
          </div>
          <p className="mt-3 text-[12.5px] leading-5 text-muted">
            {fedSummary.balance_due > 0 ? "The federal balance is paid by direct debit from the account below. A balance paid after " + fmtDate(packet.firm.deadlines.find((d) => /original/i.test(d.what))?.date ?? "") + " carries interest and a late-payment penalty computed by the IRS, even though the filing deadline was extended. " : ""}
            {caSummary.balance_due < 0 ? "The California refund is deposited to the same account." : ""}
          </p>
          <KV className="mt-2" rows={[["Account for payment and refund", bank.bank + " · " + bank.type + " · " + (reveal ? bank.account : maskAccount(bank.account))]]} />
        </Card>
      </div>

      <Card className="mt-4" title="Key lines of the returns" description={filed ? "Values as transmitted. Form and line references follow the IRS and FTB forms." : "Working values today. They can still change until the return is filed."} flush>
        <table className="tbl">
          <tbody>
            {groups.map(([group, keys]) => (
              <Fragment key={group}>
                <tr>
                  <td colSpan={3} className="bg-surface-2/60 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
                    {group}
                  </td>
                </tr>
                {keys
                  .filter((k) => FILED_LINE_KEYS.includes(k) && value(k) !== undefined)
                  .map((k) => {
                    const v = value(k)!;
                    return (
                      <tr key={k}>
                        <td>{FILED_LINE_LABELS[k] ?? k}</td>
                        <td className="font-mono text-[11px] text-muted">{k}</td>
                        <td className="text-right tabular-nums">{typeof v === "number" ? fmtMoney(v) : String(v)}</td>
                      </tr>
                    );
                  })}
              </Fragment>
            ))}
          </tbody>
        </table>
        {!filed && eff.adjustments.length ? (
          <p className="border-t border-border px-4 py-2.5 text-[12px] text-muted">
            Tax, penalty and balance lines are the engine&apos;s from {eff.version}; the result above adds the estimated effect of {eff.adjustments.length} working adjustment{eff.adjustments.length === 1 ? "" : "s"} that the engine has not recomputed yet.
          </p>
        ) : null}
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Signatures and transmission">
          {approvals.length ? (
            <ul className="grid gap-1.5 text-[13px]">
              {approvals.map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{String(a.body.signerName)}</span> signed Form 8879 and FTB 8879 electronically on {fmtDateTime(a.at)} with a self-selected PIN ending {String(a.body.pinHint)}.
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">Not yet signed. Your preparer sends the return for your approval when review is complete.</p>
          )}
          <div className="mt-3 border-t border-border pt-3 text-[13px]">
            {transmissions.length ? (
              <ul className="grid gap-1">
                {transmissions.map((t) => (
                  <li key={t.fact.id} className="flex flex-wrap items-center gap-x-2">
                    <span className="capitalize">{t.jurisdiction}</span> {t.kind === "amended" ? "amended " : ""}return · submission <span className="font-mono text-[11.5px]">{t.submissionId}</span> · {t.status} {t.ack ? fmtDate(String(t.ack.body.agencyDate)) : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-muted">Not yet transmitted.</span>
            )}
          </div>
          <KV className="mt-3" rows={[["Paid preparer", signer ? signer.name + " · PTIN " + String((identity.ptins as Record<string, string>)?.[signer.id] ?? "") : "—"], ["Firm", packet.firm.name + " · EIN " + String(identity.ein ?? "")], ["Electronic return originator", "EFIN " + String(identity.efin ?? "")]]} />
        </Card>

        <Card title={"What carries into " + (packet.household.tax_year + 1)} description="Amounts your next return starts from. Keep this page with next year's documents.">
          {carry.length ? (
            <ul className="grid gap-1 text-[13px]">
              {carry.map((r) => (
                <li key={r.id} className="flex items-baseline justify-between gap-3">
                  <span>
                    {r.label} <span className="text-[11px] text-muted">({r.jurisdiction})</span>
                  </span>
                  <span className="tabular-nums">{typeof r.value === "number" ? fmtMoney(r.value) : String(r.value)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">Nothing carries forward.</p>
          )}
          <p className="mt-3 text-[12.5px] text-muted">Keep: Forms W-2, 1099, K-1 and 1098 for this year, the donation acknowledgments, the closing statements for the home sale and purchase, and this copy, for at least three years after filing; the basis records for the S corporation, the partnership and the home for as long as you own them.</p>
          {actor.kind === "staff" ? (
            <Link href="/next-year" className="mt-3 inline-block text-[12px] text-accent hover:underline print:hidden">
              Carry forward and plan
            </Link>
          ) : null}
        </Card>
      </div>
    </>
  );
}
