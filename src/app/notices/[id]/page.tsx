import { Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/filing/action-form";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, Empty, KV } from "@/components/ui";
import { noticeResponseAction } from "@/lib/facts/actions-filing";
import { KIND_LABELS } from "@/lib/facts/types";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { noticePackage } from "@/lib/notice";
import { canRespondToNotice, canSeeLedger } from "@/lib/permissions";
import { documentHref, lineHref } from "@/lib/refs";
import { getReviewContext } from "@/lib/review";
import { getCurrentActor, getNow } from "@/lib/session";
import { sha256 } from "@/lib/signoff";
import { staffOnlyPage } from "@/lib/page-guards";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: "Notice " + id };
}

export default async function NoticePage({ params }: { params: Promise<{ id: string }> }) {
  await staffOnlyPage();
  const { id } = await params;
  const actor = await getCurrentActor();
  if (!canSeeLedger(actor)) notFound();
  const ctx = await getReviewContext();
  const notice = ctx.packet.tax_agency_records.notices.find((n) => n.id === id);
  if (!notice) notFound();
  const now = await getNow();
  const pkg = noticePackage(ctx.packet, ctx.index, ctx.ledger, ctx.eff, notice, now.iso, sha256);
  const firm = ctx.packet.firm;
  const identity = firm.firm_identity as Record<string, unknown>;
  const taxpayers = ctx.packet.household.people.filter((p) => p.role !== "dependent").map((p) => p.name).join(" and ");
  const asFiled = ctx.filing.asFiled;

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/notices" className="hover:text-foreground">
              Notices
            </Link>
            <span className="text-border-strong">/</span>
            <span className="font-mono">{notice.id}</span>
          </span>
        }
        title={notice.agency + " " + notice.type}
        description={"Tax year " + notice.tax_year + ", dated " + fmtDate(notice.dated) + (notice.response_due ? ", response due " + fmtDate(notice.response_due) : "") + ". The package below is assembled from the workpaper: nothing in it was typed for the occasion."}
        meta={
          <>
            {notice.status ? (
              <Badge tone="ok" dot>
                {notice.status}
              </Badge>
            ) : pkg.sent ? (
              <Badge tone={pkg.sentCurrent ? "ok" : "warn"} dot>
                {pkg.sentCurrent ? "response sent " + fmtDateTime(pkg.sent.at) : "sent, but the package changed since"}
              </Badge>
            ) : pkg.dueInDays !== null ? (
              <Badge tone={pkg.dueInDays < 0 ? "danger" : pkg.dueInDays <= 14 ? "warn" : "accent"} dot>
                {pkg.dueInDays < 0 ? "overdue by " + -pkg.dueInDays + " days" : pkg.dueInDays + " days to respond"}
              </Badge>
            ) : null}
            {notice.document ? <RefLink refId={notice.document} href={documentHref(notice.document)} /> : null}
            <Badge tone="neutral">{pkg.exhibits.length} exhibits</Badge>
          </>
        }
        actions={<PrintButton label="Print the package" />}
      />

      {notice.status ? (
        <Card title="Resolution">
          <p className="text-[13px]">{notice.summary}</p>
          <p className="mt-1 text-[13px] text-muted">{notice.status}</p>
        </Card>
      ) : null}

      {pkg.items.length && !notice.status ? (
        <>
          <Card title="Cover letter" description="Draft, for the signing preparer's edits." aside={<Badge tone="neutral">page 1 of the package</Badge>} flush>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-2/50 px-6 py-3">
              <span className="flex items-center gap-2.5">
                <span className="brand-mark flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-bold text-white">{firm.name.slice(0, 1)}</span>
                <span className="leading-tight">
                  <span className="block text-[13px] font-semibold">{firm.name}</span>
                  <span className="block text-[11.5px] text-muted">
                    {String(identity.address ?? "")} · {String(identity.phone ?? "")}
                  </span>
                </span>
              </span>
              <span className="text-right text-[11.5px] text-muted">
                <span className="block font-medium text-foreground">{fmtDate(now.iso)}</span>
                EIN {String(identity.ein ?? "")}
              </span>
            </div>
            <div className="max-w-3xl px-6 py-5 text-[13.5px] leading-6">
              <p className="mt-3">Re: {notice.type}, tax year {notice.tax_year}, {taxpayers}</p>
              <p className="mt-3">
                We represent the taxpayers under the enclosed authorization and respond to your letter dated {fmtDate(notice.dated)}. For each item under examination we set out the position taken on the return{asFiled ? " as filed (" + String(asFiled.fact.body.version) + ", submission " + asFiled.submissionId + ")" : ""}, the records that substantiate it, and where our own review found a correction to be made, that correction.
              </p>
              {pkg.items.map((it) => (
                <p key={it.n} className="mt-3">
                  <strong>Item {it.n}.</strong> {it.position}
                </p>
              ))}
              <p className="mt-3">The exhibits are listed and attached in order. Please direct questions to the undersigned.</p>
              <p className="mt-6 text-muted">Sincerely,</p>
              <p className="mt-4 font-medium">{firm.staff.find((s) => s.id === identity.paid_preparer_signing_returns)?.name ?? firm.name}</p>
              <p className="text-[12px] text-muted">{firm.name}</p>
            </div>
          </Card>

          {pkg.items.map((it) => (
            <Card
              key={it.n}
              className="mt-4"
              title={
                <span className="flex items-start gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-soft font-mono text-[11px] font-semibold text-accent ring-1 ring-inset ring-accent/25">{it.n}</span>
                  <span>{it.text}</span>
                </span>
              }
              description={"Topic: " + it.topic.replace(/_/g, " ") + " · " + it.exhibits.length + " exhibit" + (it.exhibits.length === 1 ? "" : "s") + " · " + it.record.length + " firm record" + (it.record.length === 1 ? "" : "s")}
              aside={<Badge tone={it.exposure.some((x) => (x.federal ?? 0) > 0) ? "warn" : "ok"} dot>{it.exposure.some((x) => (x.federal ?? 0) > 0) ? "exposure" : "no exposure expected"}</Badge>}
            >
              <div className="grid gap-6 xl:grid-cols-2">
                <div>
                  <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Return lines</h4>
                  <table className="tbl text-[12.5px]">
                    <thead>
                      <tr>
                        <th>Line</th>
                        <th className="text-right">As computed</th>
                        <th className="text-right">Working</th>
                      </tr>
                    </thead>
                    <tbody>
                      {it.lines.map((l) => (
                        <tr key={l.key}>
                          <td>
                            <Link href={lineHref(l.key)} className="hover:underline">
                              {l.label}
                            </Link>
                            <div className="font-mono text-[10.5px] text-muted">{l.key}</div>
                          </td>
                          <td className="text-right tabular-nums">{typeof l.engine === "number" ? fmtMoney(l.engine) : String(l.engine)}</td>
                          <td className="text-right tabular-nums">
                            {typeof l.working === "number" ? fmtMoney(l.working) : String(l.working)}
                            {l.adjusted ? <Badge tone="accent" className="ml-1">adjusted</Badge> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {it.reconciliation ? (
                    <div className="mt-4">
                      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">{it.reconciliation.title}</h4>
                      <table className="tbl text-[12.5px]">
                        <tbody>
                          {it.reconciliation.rows.map((r) => (
                            <tr key={r.label}>
                              <td>
                                {r.label} {r.ref ? <RefLink refId={r.ref} href={documentHref(r.ref)} /> : null}
                              </td>
                              <td className="text-right tabular-nums">{fmtMoney(r.amount)}</td>
                            </tr>
                          ))}
                          <tr className="font-medium">
                            <td>{it.reconciliation.total.label}</td>
                            <td className="text-right tabular-nums">{fmtMoney(it.reconciliation.total.amount)}</td>
                          </tr>
                          <tr className="font-medium">
                            <td>
                              <Link href={lineHref(it.reconciliation.compareTo.key)} className="hover:underline">
                                {it.reconciliation.compareTo.label}
                              </Link>
                            </td>
                            <td className="text-right tabular-nums">{fmtMoney(it.reconciliation.compareTo.amount)}</td>
                          </tr>
                          <tr>
                            <td className="text-muted">Reported in excess of third-party forms</td>
                            <td className="text-right tabular-nums text-muted">{fmtMoney(it.reconciliation.difference)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <p className="mt-2 text-[12.5px] leading-5 text-muted">{it.reconciliation.explanation}</p>
                    </div>
                  ) : null}
                </div>

                <div>
                  <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Exhibits</h4>
                  {it.exhibits.length ? (
                    <ul className="divide-y divide-border/70 rounded-lg border border-border">
                      {it.exhibits.map((e) => (
                        <li key={e.id} className="flex items-start gap-3 px-3 py-2 text-[12.5px]">
                          <span className="mt-px flex h-6 min-w-[28px] shrink-0 items-center justify-center rounded-md bg-surface-2 px-1.5 font-mono text-[11px] font-semibold ring-1 ring-inset ring-border">{e.label.replace("Exhibit ", "")}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <RefLink refId={e.documentId} href={documentHref(e.documentId, { page: e.pages[0] })} />
                              <Link href={documentHref(e.documentId, { page: e.pages[0] })} className="font-medium hover:text-accent">
                                {e.title}
                              </Link>
                            </span>
                            {e.pages.length ? <span className="block text-[11.5px] text-muted">{"page" + (e.pages.length === 1 ? " " : "s ") + e.pages.join(", ")}</span> : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty>No documents in the file support this item.</Empty>
                  )}

                  <h4 className="mb-1.5 mt-5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">The firm&apos;s own record</h4>
                  {it.record.length ? (
                    <ul className="grid gap-1 text-[12.5px]">
                      {it.record.map((f) => (
                        <li key={f.id} className="text-muted">
                          <span className="text-foreground">{KIND_LABELS[f.kind as keyof typeof KIND_LABELS] ?? f.kind}</span> on <span className="font-mono text-[11.5px]">{f.target}</span> by {f.actorName}, {fmtDate(f.at)}
                          {typeof f.body.text === "string" ? ": " + f.body.text : typeof f.body.reason === "string" ? ": " + f.body.reason : typeof f.body.type === "string" ? " (" + f.body.type.replace(/_/g, " ") + ")" : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-lg border border-dashed border-warn/40 bg-warn-soft/30 px-3 py-2 text-[12.5px] leading-5 text-warn">No verification, note or adjustment was recorded on these lines or documents. The examiner will ask why.</p>
                  )}

                  <h4 className="mb-1.5 mt-5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Exposure</h4>
                  <ul className="grid gap-1.5 text-[12.5px]">
                    {it.exposure.map((x, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Badge tone={x.federal === null ? "neutral" : x.federal > 0 ? "danger" : x.federal < 0 ? "ok" : "neutral"} className="shrink-0">
                          {x.federal === null ? "unknown" : x.federal > 0 ? "+" + fmtMoney(x.federal) + " tax" : x.federal < 0 ? fmtMoney(x.federal) + " tax" : "none"}
                        </Badge>
                        <span>{x.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ))}

          <Card className="mt-4" title="Send the response" description="Recording the send stores the package's fingerprint. If a line or exhibit changes afterwards, the record shows the package is stale.">
            <KV
              rows={[
                ["Items", String(pkg.items.length)],
                ["Exhibits", pkg.exhibits.map((e) => e.label + " " + e.documentId).join(", ")],
                ["Package fingerprint", <span key="h" className="font-mono text-[11px]">{pkg.hash.slice(0, 16)}</span>],
                ["Last sent", pkg.sent ? fmtDateTime(pkg.sent.at) + " by " + pkg.sent.actorName : "never"],
              ]}
            />
            <div className="mt-3">
              <ActionForm action={noticeResponseAction} hidden={{ noticeId: notice.id }} label={pkg.sent ? "Record a re-send" : "Record the response as sent"} icon={<Send className="h-3.5 w-3.5" />} primary disabled={!canRespondToNotice(actor)} disabledReason="Preparer-and-above sends the response." fields={[{ name: "text", label: "How it was sent", type: "textarea", placeholder: "Faxed to the number on the letter; confirmation kept in the file." }]} />
            </div>
          </Card>
        </>
      ) : null}
    </>
  );
}
