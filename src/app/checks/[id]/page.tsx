import { ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, ClipboardList, FileText, Gavel, Hash, Landmark, PencilLine, ScanSearch, UserRound, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { EffectBadge, SEVERITY_TONE, SeverityIcon } from "@/components/checks/finding-row";
import { FactsPanel } from "@/components/facts/facts-panel";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, cn, Empty, Pill } from "@/components/ui";
import { runChecks } from "@/lib/checks/run";
import { AREA_LABELS, type Severity } from "@/lib/checks/types";
import { resolvedFindingIds } from "@/lib/completeness";
import { activeAdjustments } from "@/lib/effective";
import { factsContext } from "@/lib/facts/context";
import { getLedger } from "@/lib/facts/repo";
import { fmtDateTime, fmtMoney, fmtNumber } from "@/lib/format";
import { maskText } from "@/lib/mask";
import { describeRef } from "@/lib/packet/describe";
import { getPacket } from "@/lib/packet/load";
import { canAdjust, canCorrectIdentity } from "@/lib/permissions";
import { lineHref, parseRef, type RefKind } from "@/lib/refs";
import { getViewer } from "@/lib/session";
import { staffOnlyPage } from "@/lib/page-guards";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: "Check · " + decodeURIComponent(id) };
}

const REF_ICON: Partial<Record<RefKind, ReactNode>> = {
  line: <Hash className="h-3.5 w-3.5" />,
  value: <ScanSearch className="h-3.5 w-3.5" />,
  document: <FileText className="h-3.5 w-3.5" />,
  questionnaire: <ClipboardList className="h-3.5 w-3.5" />,
  message: <ClipboardList className="h-3.5 w-3.5" />,
  call: <ClipboardList className="h-3.5 w-3.5" />,
  person: <Users className="h-3.5 w-3.5" />,
  staff: <UserRound className="h-3.5 w-3.5" />,
  agency: <Landmark className="h-3.5 w-3.5" />,
  prior_year: <CalendarClock className="h-3.5 w-3.5" />,
  timeline: <CalendarClock className="h-3.5 w-3.5" />,
};

const SEVERITY_MEANING: Record<Severity, string> = {
  error: "The evidence contradicts a number on the return. Something has to change, or someone has to say why not.",
  warning: "Not wrong on its face, but a person needs to decide. Record the decision so the file shows it was considered.",
  info: "Worth knowing. Nothing on the return is implied to change.",
};

const num = (s: string | undefined) => (s !== undefined && /^-?[\d,]+(\.\d+)?$/.test(s) ? Number(s.replace(/,/g, "")) : null);

export default async function FindingPage({ params }: Props) {
  await staffOnlyPage();
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const { packet, index } = getPacket();
  const run = runChecks(packet, index);
  const f = run.findings.find((x) => x.id === id);
  if (!f) notFound();
  const result = run.results.find((r) => r.check === f.check)!;
  const [{ literals }, { ledger }, ctx] = await Promise.all([getViewer(), getLedger(), factsContext()]);
  const target = "check:" + f.id;
  const mask = (s: string) => maskText(s, literals);

  // A finding with one expected number on one numeric line can be turned into an adjustment in a click.
  const expectedNumber = f.expected && /^-?[\d,]+(\.\d+)?$/.test(f.expected) ? f.expected.replace(/,/g, "") : null;
  const lineRef = f.refs.map(parseRef).find((r) => r.kind === "line" && typeof index.lines.get(index.latestVersion)?.get(r.key)?.value === "number");
  const proposeHref =
    expectedNumber && lineRef && lineRef.kind === "line" && canAdjust(ctx.actor)
      ? lineHref(lineRef.key) + "?adjust=" + encodeURIComponent(expectedNumber) + "&reason=" + encodeURIComponent(f.title + ". " + f.detail.slice(0, 300)) + "&from=" + encodeURIComponent(target)
      : null;
  const identity = f.check === "identity-documents";

  // How it stands: adjustments made from it, judgments recorded on it.
  const adjustments = activeAdjustments(ledger).filter((a) => a.fromFinding === target);
  const judgments = ledger.forTarget(target).filter((x) => x.kind === "judgment" && !x.retracted);
  const resolvedIds = resolvedFindingIds(ledger);
  const resolved = resolvedIds.has(f.id);
  const summary = ledger.summary(target);

  // Siblings from the same check, for prev / next.
  const siblings = result.findings;
  const at = siblings.findIndex((x) => x.id === f.id);
  const prev = at > 0 ? siblings[at - 1] : null;
  const next = at < siblings.length - 1 ? siblings[at + 1] : null;

  const actualN = num(f.actual);
  const expectedN = num(f.expected);
  const numeric = actualN !== null || expectedN !== null;
  const hasCompare = f.expected !== undefined || f.actual !== undefined;
  const sign = (n: number) => (n === 0 ? "0" : (n > 0 ? "+" : "−") + fmtNumber(Math.abs(n)));

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-1.5">
            <Link href="/checks" className="hover:underline">
              Checks
            </Link>
            <span className="text-border-strong">/</span>
            <Link href={"/checks?area=" + f.area} className="hover:underline">
              {AREA_LABELS[f.area]}
            </Link>
            <span className="text-border-strong">/</span>
            <span>{result.title}</span>
          </span>
        }
        title={
          <span className="flex items-start gap-2.5">
            <SeverityIcon severity={f.severity} className="mt-1 h-7 w-7 rounded-lg [&>svg]:h-4 [&>svg]:w-4" />
            <span className="min-w-0">{f.title}</span>
          </span>
        }
        description={f.detail}
        meta={
          <>
            <Badge tone={SEVERITY_TONE[f.severity]} dot>
              {f.severity}
            </Badge>
            {resolved ? (
              <Badge tone="ok" dot>
                addressed
              </Badge>
            ) : (
              <Badge tone={f.severity === "error" ? "danger" : "neutral"}>open</Badge>
            )}
            <EffectBadge effect={f.effect} />
            <Badge tone="neutral" mono>
              {target}
            </Badge>
          </>
        }
        actions={
          <>
            {prev ? (
              <Link href={"/checks/" + encodeURIComponent(prev.id)} className="icon-btn" title={"Previous: " + prev.title} aria-label="Previous finding">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            ) : null}
            {next ? (
              <Link href={"/checks/" + encodeURIComponent(next.id)} className="icon-btn" title={"Next: " + next.title} aria-label="Next finding">
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
            {proposeHref ? (
              <Pill href={proposeHref} primary icon={<PencilLine className="h-3.5 w-3.5" />}>
                Propose adjustment to {lineRef && lineRef.kind === "line" ? lineRef.key : ""}
              </Pill>
            ) : null}
            {identity && canCorrectIdentity(ctx.actor) ? (
              <Pill href="/filing" primary={!proposeHref}>
                Record the correction on Filing
              </Pill>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid content-start gap-4 xl:col-span-2">
          {/* The comparison, big. */}
          {hasCompare ? (
            <section className="card overflow-hidden">
              <div className={cn("grid divide-y divide-border md:divide-x md:divide-y-0", numeric && actualN !== null && expectedN !== null ? "md:grid-cols-3" : "md:grid-cols-2")}>
                <div className="p-5">
                  <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">On the return</div>
                  <div className={cn("mt-2 font-mono font-semibold leading-none tracking-[-0.02em] tabular-nums", numeric ? "text-[30px]" : "text-[18px] leading-6")}>{f.actual ?? "—"}</div>
                </div>
                <div className="p-5">
                  <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Evidence says</div>
                  <div className={cn("mt-2 font-mono font-semibold leading-none tracking-[-0.02em] tabular-nums", numeric ? "text-[30px]" : "text-[18px] leading-6", f.severity === "error" ? "text-danger" : f.severity === "warning" ? "text-warn" : "")}>{f.expected ?? "—"}</div>
                </div>
                {numeric && actualN !== null && expectedN !== null ? (
                  <div className="bg-surface-2/40 p-5">
                    <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Difference</div>
                    <div className="mt-2 font-mono text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{sign(f.difference ?? actualN - expectedN)}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                      {f.effect && (f.effect.federal || f.effect.california) ? (
                        <>
                          <span>if corrected, tax moves</span>
                          <EffectBadge effect={f.effect} />
                        </>
                      ) : (
                        <span>return minus evidence</span>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex items-start gap-2 border-t border-border px-5 py-3 text-[12.5px] leading-5 text-muted">
                <SeverityIcon severity={f.severity} className="h-5 w-5 rounded [&>svg]:h-3 [&>svg]:w-3" />
                <span>{SEVERITY_MEANING[f.severity]}</span>
              </div>
            </section>
          ) : (
            <div className="card flex items-start gap-3 px-5 py-4 text-[13px] leading-5">
              <SeverityIcon severity={f.severity} className="mt-0.5" />
              <span className="text-muted">{SEVERITY_MEANING[f.severity]}</span>
            </div>
          )}

          {/* Evidence */}
          <Card title="Evidence" description="Everything this finding rests on. Each link opens the record itself; sensitive identifiers stay masked unless the file is in reveal." aside={f.refs.length + " record" + (f.refs.length === 1 ? "" : "s")} flush>
            <ul className="divide-y divide-border">
              {f.refs.map((r) => {
                const d = describeRef(r, packet, index);
                const kind = parseRef(r).kind;
                return (
                  <li key={r} className="flex items-start gap-3 px-5 py-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted ring-1 ring-inset ring-border">{REF_ICON[kind] ?? <Hash className="h-3.5 w-3.5" />}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <RefLink refId={r} />
                        <span className="text-[13px] font-medium">{mask(d.label)}</span>
                      </div>
                      {d.detail ? <div className="mt-0.5 text-[12px] leading-4 text-muted">{mask(d.detail)}</div> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* How it stands */}
          <Card
            title={
              <span className="flex items-center gap-2">
                {resolved ? <CheckCircle2 className="h-4 w-4 text-ok" /> : null}
                How it stands
              </span>
            }
            description={resolved ? "Something was done about this finding. The check still reports it, because checks describe the packet, not the ledger." : "Nothing has been done about this finding yet."}
            flush
          >
            {adjustments.length || judgments.length ? (
              <ul className="divide-y divide-border">
                {adjustments.map((a) => (
                  <li key={a.factId} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent ring-1 ring-inset ring-accent/25">
                      <PencilLine className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
                        <span className="font-medium">Adjusted</span>
                        <RefLink refId={a.key} href={lineHref(a.key)} />
                        <span className="font-mono tabular-nums text-muted">{fmtNumber(a.engineValue)}</span>
                        <ArrowRight className="h-3 w-3 text-border-strong" />
                        <span className="font-mono font-semibold tabular-nums">{fmtNumber(a.newValue)}</span>
                        {a.effect.affectsTax ? <Badge tone={a.effect.federal + a.effect.california > 0 ? "warn" : "ok"}>tax {(a.effect.federal + a.effect.california > 0 ? "+" : "−") + fmtMoney(Math.abs(a.effect.federal + a.effect.california))}</Badge> : null}
                        {a.requiresPartner ? <Badge tone="warn">partner approval</Badge> : null}
                      </div>
                      <div className="mt-0.5 text-[12px] leading-4 text-muted">
                        {a.reason}
                        {a.authority ? " (" + a.authority + ")" : ""} · {a.actorName}, {fmtDateTime(a.at)}
                      </div>
                    </div>
                  </li>
                ))}
                {judgments.map((j) => (
                  <li key={j.id} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ok-soft text-ok ring-1 ring-inset ring-ok/20">
                      <Gavel className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px]">
                        <span className="font-medium">Judgment recorded</span>
                        {typeof j.body.choice === "string" && j.body.choice ? <span className="text-muted"> · {j.body.choice}</span> : null}
                      </div>
                      <div className="mt-0.5 text-[12.5px] leading-5">{String(j.body.text ?? "")}</div>
                      <div className="mt-0.5 text-[12px] text-muted">
                        {j.actorName}, {fmtDateTime(j.at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid gap-2 p-5 text-[12.5px] leading-5 text-muted sm:grid-cols-2">
                <div className="rounded-lg border border-dashed border-border px-3 py-2.5">
                  <div className="font-medium text-foreground">Change the return</div>
                  {proposeHref ? (
                    <>
                      Propose the evidence figure as an adjustment to {lineRef && lineRef.kind === "line" ? lineRef.key : "the line"}. It records here as the reason.
                    </>
                  ) : (
                    <>Open the cited line and adjust it; name this finding as the reason so the two stay linked.</>
                  )}
                </div>
                <div className="rounded-lg border border-dashed border-border px-3 py-2.5">
                  <div className="font-medium text-foreground">Or explain why not</div>
                  Verify, note or ask under Resolution. {summary.openQuestions ? summary.openQuestions + " question" + (summary.openQuestions === 1 ? " is" : "s are") + " already open." : "A verification or a note with a reason is enough for the reviewer."}
                </div>
              </div>
            )}
          </Card>

          {/* The check itself */}
          <Card title="What this check does" description={result.coverage} aside={<span className="font-mono text-[11px]">{f.check}</span>} flush>
            {siblings.length > 1 ? (
              <ul className="divide-y divide-border">
                {siblings.map((s) => (
                  <li key={s.id}>
                    <Link href={"/checks/" + encodeURIComponent(s.id)} className={cn("flex items-center gap-3 px-5 py-2 hover:bg-surface-2/60", s.id === f.id && "bg-accent-soft/20")} aria-current={s.id === f.id ? "page" : undefined}>
                      <SeverityIcon severity={s.severity} className="h-5 w-5 rounded [&>svg]:h-3 [&>svg]:w-3" />
                      <span className={cn("min-w-0 flex-1 truncate text-[12.5px]", s.id === f.id && "font-semibold")}>{s.title}</span>
                      {resolvedIds.has(s.id) ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-ok" /> : null}
                      <span className="w-6 text-right font-mono text-[10.5px] text-muted">{siblings.indexOf(s) + 1}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-3 text-[12.5px] text-muted">The only finding of this check in {run.version}.</div>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <FactsPanel target={target} facts={ledger.forTarget(target)} actor={ctx.actor} staff={ctx.staff} verificationTypes={ctx.verificationTypes} title="Resolution" />
          {!hasCompare && f.refs.length === 0 ? <Empty>No evidence attached.</Empty> : null}
        </div>
      </div>
    </>
  );
}
