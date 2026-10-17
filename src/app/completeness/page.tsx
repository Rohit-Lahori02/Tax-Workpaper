import { ArrowUpRight, CheckCircle2, Circle, CircleDashed, Lock, OctagonAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DispositionForm } from "@/components/completeness/disposition-form";
import { StepToggle } from "@/components/completeness/step-toggle";
import { typeIcon } from "@/components/documents/type-icon";
import { JudgmentForm, type RecordedJudgment } from "@/components/judgment/judgment-form";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, cn, Stat } from "@/components/ui";
import { runChecks } from "@/lib/checks/run";
import { areaStatuses, decisionPoints, documentAccounting, dueDiligenceItems, outsideFilings, requiredSteps, varianceItems } from "@/lib/completeness";
import { effectiveReturn } from "@/lib/effective";
import { factsContext } from "@/lib/facts/context";
import { getLedger } from "@/lib/facts/repo";
import type { Disposition, FactView } from "@/lib/facts/types";
import { fmtDate } from "@/lib/format";
import { canNote, canVerify } from "@/lib/permissions";
import { documentHref } from "@/lib/refs";
import { getEffectivePacket } from "@/lib/standards-server";

export const metadata: Metadata = { title: "Completeness" };

function recorded(f: FactView | null): RecordedJudgment | null {
  if (!f) return null;
  return {
    actorName: f.actorName,
    at: f.at,
    text: String(f.body.text ?? ""),
    authority: typeof f.body.authority === "string" ? f.body.authority : undefined,
    status: typeof f.body.status === "string" ? f.body.status : undefined,
  };
}

const FILING_STATUSES = [
  { id: "informed", label: "Client informed in writing" },
  { id: "referred", label: "Referred to the other preparer" },
  { id: "filed", label: "Filed" },
  { id: "not_required", label: "Determined not required" },
];

function StepIcon({ auto, done }: { auto: string | null; done: boolean }) {
  const base = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset";
  if (auto === "later") return <span className={cn(base, "bg-surface-2 text-muted ring-border")}><Lock className="h-3 w-3" /></span>;
  if (done) return <span className={cn(base, "bg-ok-soft text-ok ring-ok/25")}><CheckCircle2 className="h-3.5 w-3.5" /></span>;
  if (auto === "blocked") return <span className={cn(base, "bg-danger-soft text-danger ring-danger/25")}><OctagonAlert className="h-3.5 w-3.5" /></span>;
  if (auto === "open") return <span className={cn(base, "bg-warn-soft text-warn ring-warn/25")}><CircleDashed className="h-3.5 w-3.5" /></span>;
  return <span className={cn(base, "bg-surface-2 text-muted ring-border")}><Circle className="h-3.5 w-3.5" /></span>;
}

export default async function CompletenessPage() {
  const { packet, index } = await getEffectivePacket();
  const [{ ledger }, ctx] = await Promise.all([getLedger(), factsContext()]);
  const checks = runChecks(packet, index);
  const eff = effectiveReturn(packet, index, ledger);
  const docs = documentAccounting(index, ledger);
  const variances = varianceItems(packet, index, ledger, eff);
  const dd = dueDiligenceItems(packet, index, ledger);
  const decisions = decisionPoints(packet, index, ledger);
  const steps = requiredSteps(packet, index, ledger, { variances, dueDiligence: dd, decisions, documents: docs, checks });
  const areas = areaStatuses(packet, index, ledger, checks);
  const filings = outsideFilings(packet, index, ledger);
  const canStep = canVerify(ctx.actor);
  const canDisp = canNote(ctx.actor);
  const unaccounted = docs.filter((d) => !d.accounted);
  const activeSteps = steps.filter((s) => s.auto !== "later");
  const stepsDone = activeSteps.filter((s) => s.done).length;
  const blocked = steps.filter((s) => s.auto === "blocked").length;
  const reachedDocs = docs.filter((d) => d.state === "reached");
  const listedDocs = [...unaccounted, ...docs.filter((d) => d.accounted && d.state !== "reached")];
  const anchors = [
    ["#steps", "Required steps", stepsDone + "/" + activeSteps.length],
    ["#documents", "Documents", String(unaccounted.length) + " open"],
    ["#areas", "Areas", areas.filter((a) => a.reviewed).length + "/" + areas.length],
    ["#filings", "Outside filings", filings.filter((f) => f.recorded).length + "/" + filings.length],
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow="Review"
        title="Completeness"
        description="Proof that nothing was skipped: every document used or explained, every area considered, every filing outside this return identified, and the firm's required steps. Statuses are computed from the packet and the ledger wherever the evidence allows; the rest needs a person to confirm."
        meta={
          <>
            <Badge tone={stepsDone === activeSteps.length ? "ok" : "neutral"} dot>
              {stepsDone} of {activeSteps.length} steps done
            </Badge>
            {blocked ? (
              <Badge tone="danger" dot>
                {blocked} blocked by evidence
              </Badge>
            ) : null}
            {unaccounted.length ? (
              <Badge tone="warn" dot>
                {unaccounted.length} documents unexplained
              </Badge>
            ) : (
              <Badge tone="ok" dot>
                every document explained
              </Badge>
            )}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Required steps" value={stepsDone + " / " + activeSteps.length} hint={steps.length - activeSteps.length + " more come with the review workflow"} tone={stepsDone === activeSteps.length ? "ok" : undefined} />
        <Stat label="Documents accounted for" value={docs.length - unaccounted.length + " / " + docs.length} tone={unaccounted.length ? "warn" : "ok"} hint={unaccounted.length ? unaccounted.length + " need a disposition" : "every document explained"} />
        <Stat label="Areas reviewed" value={areas.filter((a) => a.reviewed).length + " / " + areas.length} hint="recorded as considered" />
        <Stat label="Outside filings" value={filings.filter((f) => f.recorded).length + " / " + filings.length} hint="addressed" tone={filings.every((f) => f.recorded) ? "ok" : "warn"} />
      </div>

      <nav className="seg mt-5 w-fit" aria-label="Sections">
        {anchors.map(([href, label, n]) => (
          <a key={href} href={href} className="seg-item">
            {label}
            <span className="font-mono text-[10.5px] text-muted">{n}</span>
          </a>
        ))}
      </nav>

      <Card
        id="steps"
        className="mt-4 scroll-mt-24"
        title="Required steps"
        description="From the firm's standards. Computed statuses cannot be ticked past contradicting evidence."
        aside={
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
              <span className={cn("block h-full rounded-full", stepsDone === activeSteps.length ? "bg-ok" : "bg-accent")} style={{ width: Math.round((stepsDone / Math.max(1, activeSteps.length)) * 100) + "%" }} />
            </span>
            <span className="tabular-nums">
              {stepsDone} / {activeSteps.length}
            </span>
          </span>
        }
        flush
      >
        <ol className="divide-y divide-border">
          {steps.map((s) => (
            <li key={s.index} className={cn("flex items-start gap-3 px-5 py-3", s.auto === "later" && "opacity-60", s.auto === "blocked" && "bg-danger-soft/10")}>
              <StepIcon auto={s.auto} done={s.done} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
                  <span className="font-mono text-[10.5px] text-muted">{String(s.index + 1).padStart(2, "0")}</span>
                  <span className="font-medium">{s.label}</span>
                  {s.auto === "blocked" ? <Badge tone="danger">blocked by evidence</Badge> : null}
                  {s.auto === "done" ? <Badge tone="ok">computed</Badge> : null}
                  {s.manual?.body.done === true && s.auto !== "done" ? <Badge tone="accent">confirmed by {s.manual.actorName}</Badge> : null}
                </div>
                <p className="mt-0.5 text-[12.5px] leading-5 text-muted">{s.detail}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {s.href ? (
                  <Link href={s.href} className="pill h-7 px-2.5 text-[12px]">
                    Go there <ArrowUpRight className="h-3 w-3" />
                  </Link>
                ) : null}
                <StepToggle target={s.target} done={s.manual?.body.done === true} locked={s.auto === "done" || s.auto === "blocked" || s.auto === "later"} allowed={canStep} />
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card
        id="documents"
        className="mt-4 scroll-mt-24"
        title="Every document used or explained"
        description={unaccounted.length ? unaccounted.length + " documents reach no line of the return and have no disposition yet. A disposition says why that is fine." : "Every document feeds the return, was superseded, or carries a disposition."}
        aside={<Badge tone={unaccounted.length ? "warn" : "ok"} dot>{unaccounted.length ? unaccounted.length + " open" : "all explained"}</Badge>}
        flush
      >
        <table className="tbl dense">
          <thead>
            <tr>
              <th className="w-10"></th>
              <th>Document</th>
              <th>State</th>
              <th>Disposition</th>
            </tr>
          </thead>
          <tbody>
            {listedDocs.map((d) => {
              const Icon = typeIcon(d.doc.document_type);
              return (
                <tr key={d.doc.id} className={cn(!d.accounted && "bg-warn-soft/10")}>
                  <td className="pl-4 pr-0">
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-inset", d.state === "not_extracted" ? "bg-danger-soft text-danger ring-danger/20" : !d.accounted ? "bg-warn-soft text-warn ring-warn/25" : "bg-surface-2 text-muted ring-border")}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>
                  </td>
                  <td className="max-w-md">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <RefLink refId={d.doc.id} href={documentHref(d.doc.id)} />
                      <Link href={documentHref(d.doc.id)} className="font-medium hover:text-accent">
                        {d.doc.title}
                      </Link>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      {d.doc.document_type} · {d.doc.issuer}
                    </div>
                  </td>
                  <td>
                    <Badge tone={d.state === "superseded" ? "neutral" : d.state === "not_extracted" ? "danger" : "warn"} dot>
                      {d.state.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="min-w-[320px]">
                    <DispositionForm
                      docId={d.doc.id}
                      current={d.disposition ? { disposition: d.disposition.body.disposition as Disposition, text: typeof d.disposition.body.text === "string" ? d.disposition.body.text : undefined, actorName: d.disposition.actorName } : null}
                      allowed={canDisp}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <details className="border-t border-border px-5 py-2.5 text-[12.5px]">
          <summary className="cursor-pointer text-muted hover:text-foreground">{reachedDocs.length} documents feed the return directly</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {reachedDocs.map((d) => (
              <RefLink key={d.doc.id} refId={d.doc.id} />
            ))}
          </div>
        </details>
      </Card>

      <Card
        id="areas"
        className="mt-4 scroll-mt-24"
        title="Every area considered"
        description="One row per area of the firm's budget. The numbers are live; the last column is a person saying the area was looked at and nothing further is needed."
        flush
      >
        <div className="overflow-auto">
          <table className="tbl dense">
            <thead>
              <tr>
                <th>Area</th>
                <th className="num">Budget h</th>
                <th>Verified</th>
                <th className="num">Check errors</th>
                <th className="num">Open Qs</th>
                <th className="num">Blocking</th>
                <th>Considered</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => {
                const pct = a.lines ? Math.round((a.verified / a.lines) * 100) : 0;
                return (
                  <tr key={a.id}>
                    <td>
                      <div className="font-medium">{a.label}</div>
                      <div className="text-[11px] text-muted">
                        {a.lines ? a.lines + " lines" : "no lines"} · {a.documents} docs
                      </div>
                    </td>
                    <td className="num text-muted">{a.budgetHours}</td>
                    <td className="min-w-[140px]">
                      {a.lines ? (
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                            <span className={cn("block h-full rounded-full", pct === 100 ? "bg-ok" : "bg-accent")} style={{ width: pct + "%" }} />
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-muted">
                            {a.verified}/{a.lines}
                          </span>
                        </span>
                      ) : (
                        <span className="text-border-strong">—</span>
                      )}
                    </td>
                    <td className="num">
                      {a.checkErrors ? (
                        <span className={cn("rounded-md px-1.5 font-mono text-[11px] leading-[18px]", a.checkErrorsResolved === a.checkErrors ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger")}>
                          {a.checkErrorsResolved}/{a.checkErrors}
                        </span>
                      ) : (
                        <span className="text-border-strong">—</span>
                      )}
                    </td>
                    <td className={cn("num", a.openQuestions ? "text-accent" : "text-border-strong")}>{a.openQuestions || "—"}</td>
                    <td className={cn("num", a.blocking ? "text-danger" : "text-border-strong")}>{a.blocking || "—"}</td>
                    <td className="min-w-[280px]">
                      <JudgmentForm target={a.target} type="area_review" recorded={recorded(a.reviewed)} allowed={canStep} compact buttonLabel="Mark considered" placeholder="What was reviewed in this area and what remains" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <section id="filings" className="mt-4 scroll-mt-24">
        <div className="grid gap-4 lg:grid-cols-2">
          {filings.map((f) => (
            <Card
              key={f.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {f.title}
                  {f.recorded ? (
                    <Badge tone="ok" dot>
                      addressed
                    </Badge>
                  ) : (
                    <Badge tone="warn" dot>
                      open
                    </Badge>
                  )}
                </span>
              }
              description={"Outside this return · " + f.owner + (f.due ? " · due " + fmtDate(f.due) : "")}
            >
              <p className="text-[13px] leading-5">{f.why}</p>
              <div className="my-3 flex flex-wrap gap-1.5">
                {f.refs.map((r) => (
                  <RefLink key={r} refId={r} />
                ))}
              </div>
              <JudgmentForm target={f.target} type="outside_filing" recorded={recorded(f.recorded)} statuses={FILING_STATUSES} allowed={canStep} buttonLabel="Record what was done" placeholder="Who was told what, and when" />
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
