import { CheckCircle2, Circle, CircleDashed, Lock, OctagonAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DispositionForm } from "@/components/completeness/disposition-form";
import { StepToggle } from "@/components/completeness/step-toggle";
import { JudgmentForm, type RecordedJudgment } from "@/components/judgment/judgment-form";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, cn, SectionTitle, Stat } from "@/components/ui";
import { runChecks } from "@/lib/checks/run";
import { areaStatuses, decisionPoints, documentAccounting, dueDiligenceItems, outsideFilings, requiredSteps, varianceItems } from "@/lib/completeness";
import { effectiveReturn } from "@/lib/effective";
import { factsContext } from "@/lib/facts/context";
import { getLedger } from "@/lib/facts/repo";
import type { Disposition, FactView } from "@/lib/facts/types";
import { fmtDate } from "@/lib/format";
import { getEffectivePacket } from "@/lib/standards-server";
import { canNote, canVerify } from "@/lib/permissions";
import { documentHref } from "@/lib/refs";

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
  const stepsDone = steps.filter((s) => s.done).length;
  const activeSteps = steps.filter((s) => s.auto !== "later").length;

  return (
    <>
      <PageHeader
        title="Completeness"
        description="Proof that nothing was skipped: every document used or explained, every area considered, every filing outside this return identified, and the firm's required steps. Statuses are computed from the packet and the ledger wherever the evidence allows; the rest needs a person to confirm."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Required steps" value={stepsDone + " / " + activeSteps} hint={steps.length - activeSteps + " more come with the review workflow"} tone={stepsDone === activeSteps ? "ok" : undefined} />
        <Stat label="Documents accounted for" value={docs.length - unaccounted.length + " / " + docs.length} tone={unaccounted.length ? "warn" : "ok"} hint={unaccounted.length ? unaccounted.length + " need a disposition" : "every document explained"} />
        <Stat label="Areas reviewed" value={areas.filter((a) => a.reviewed).length + " / " + areas.length} hint="recorded as considered" />
        <Stat label="Outside filings" value={filings.filter((f) => f.recorded).length + " / " + filings.length} hint="addressed" tone={filings.every((f) => f.recorded) ? "ok" : "warn"} />
      </div>

      <section id="steps" className="mt-6 scroll-mt-20">
        <SectionTitle>Required steps</SectionTitle>
        <Card description="From the firm's standards. Computed statuses cannot be ticked past contradicting evidence." flush>
          <ol className="divide-y divide-border">
            {steps.map((s) => (
              <li key={s.index} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5">
                  {s.auto === "later" ? (
                    <Lock className="h-4 w-4 text-muted" />
                  ) : s.done ? (
                    <CheckCircle2 className="h-4 w-4 text-ok" />
                  ) : s.auto === "blocked" ? (
                    <OctagonAlert className="h-4 w-4 text-danger" />
                  ) : s.auto === "open" ? (
                    <CircleDashed className="h-4 w-4 text-warn" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
                    <span className={cn("font-medium", s.auto === "later" && "text-muted")}>
                      {s.index + 1}. {s.label}
                    </span>
                    {s.auto === "blocked" ? <Badge tone="danger">blocked by evidence</Badge> : null}
                    {s.manual?.body.done === true && s.auto !== "done" ? <Badge tone="accent">confirmed by {s.manual.actorName}</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    {s.detail}{" "}
                    {s.href ? (
                      <Link href={s.href} className="text-accent hover:underline">
                        Go there
                      </Link>
                    ) : null}
                  </p>
                </div>
                <StepToggle target={s.target} done={s.manual?.body.done === true} locked={s.auto === "done" || s.auto === "blocked" || s.auto === "later"} allowed={canStep} />
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section id="documents" className="mt-6 scroll-mt-20">
        <SectionTitle>Every document used or explained</SectionTitle>
        <Card description={unaccounted.length ? unaccounted.length + " documents reach no line of the return and have no disposition yet." : "Every document feeds the return, was superseded, or carries a disposition."} flush>
          <table className="tbl dense">
            <thead>
              <tr>
                <th>Document</th>
                <th>State</th>
                <th>Disposition</th>
              </tr>
            </thead>
            <tbody>
              {[...unaccounted, ...docs.filter((d) => d.accounted && d.state !== "reached")].map((d) => (
                <tr key={d.doc.id}>
                  <td className="max-w-md">
                    <Link href={documentHref(d.doc.id)} className="font-medium hover:underline">
                      {d.doc.title}
                    </Link>
                    <div className="text-[11px] text-muted">
                      <span className="font-mono">{d.doc.id}</span> · {d.doc.document_type} · {d.doc.issuer}
                    </div>
                  </td>
                  <td>
                    <Badge tone={d.state === "superseded" ? "neutral" : d.state === "not_extracted" ? "danger" : "warn"}>{d.state.replace("_", " ")}</Badge>
                  </td>
                  <td>
                    <DispositionForm
                      docId={d.doc.id}
                      current={d.disposition ? { disposition: d.disposition.body.disposition as Disposition, text: typeof d.disposition.body.text === "string" ? d.disposition.body.text : undefined, actorName: d.disposition.actorName } : null}
                      allowed={canDisp}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <details className="border-t border-border px-4 py-2 text-[12.5px]">
            <summary className="cursor-pointer text-muted">{docs.filter((d) => d.state === "reached").length} documents feed the return directly</summary>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {docs
                .filter((d) => d.state === "reached")
                .map((d) => (
                  <RefLink key={d.doc.id} refId={d.doc.id}>
                    {d.doc.id}
                  </RefLink>
                ))}
            </div>
          </details>
        </Card>
      </section>

      <section id="areas" className="mt-6 scroll-mt-20">
        <SectionTitle>Every area considered</SectionTitle>
        <Card description="One row per area of the firm's budget. The numbers are live; the last column is a person saying the area was looked at and nothing further is needed." flush>
          <div className="overflow-auto">
            <table className="tbl dense">
              <thead>
                <tr>
                  <th>Area</th>
                  <th className="num">Budget h</th>
                  <th className="num">Lines</th>
                  <th className="num">Verified</th>
                  <th className="num">Check errors</th>
                  <th className="num">Open Qs</th>
                  <th className="num">Blocking</th>
                  <th>Considered</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a.id}>
                    <td className="font-medium">{a.label}</td>
                    <td className="num text-muted">{a.budgetHours}</td>
                    <td className="num">{a.lines || "—"}</td>
                    <td className={cn("num", a.lines && a.verified === a.lines ? "text-ok" : "")}>{a.lines ? a.verified : "—"}</td>
                    <td className="num">
                      {a.checkErrors ? (
                        <span className={a.checkErrorsResolved === a.checkErrors ? "text-ok" : "text-danger"}>
                          {a.checkErrorsResolved}/{a.checkErrors}
                        </span>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                    <td className={cn("num", a.openQuestions && "text-accent")}>{a.openQuestions || "—"}</td>
                    <td className={cn("num", a.blocking && "text-danger")}>{a.blocking || "—"}</td>
                    <td className="min-w-[260px]">
                      <JudgmentForm target={a.target} type="area_review" recorded={recorded(a.reviewed)} allowed={canStep} compact buttonLabel="Mark considered" placeholder="What was reviewed in this area and what remains" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section id="filings" className="mt-6 scroll-mt-20">
        <SectionTitle>Filings outside this return</SectionTitle>
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
              description={f.owner + (f.due ? " · due " + fmtDate(f.due) : "")}
            >
              <p className="text-[13px]">{f.why}</p>
              <div className="my-2 flex flex-wrap gap-x-3 gap-y-0.5">
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
