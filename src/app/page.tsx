import { ArrowRight, ArrowUpRight, Check, Files, FileSpreadsheet, Inbox } from "lucide-react";
import Link from "next/link";
import { EffectBadge, SeverityIcon } from "@/components/checks/finding-row";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Sparkline } from "@/components/sparkline";
import { Badge, Card, cn, Empty, KV, Pill, SectionTitle, StackedBar, Stat, type Tone } from "@/components/ui";
import { runChecks } from "@/lib/checks/run";
import { decisionPoints, documentAccounting, dueDiligenceItems, requiredSteps, varianceItems } from "@/lib/completeness";
import { effectiveReturn } from "@/lib/effective";
import { getLedger } from "@/lib/facts/repo";
import { KIND_LABELS, type FactKind } from "@/lib/facts/types";
import { filingStatusLabel, fmtBalance, fmtDate, fmtDateTime, fmtMoney, fmtNumber } from "@/lib/format";
import { maskPin, maskSsn } from "@/lib/mask";
import { documentRows } from "@/lib/packet/documents";
import { getPacket } from "@/lib/packet/load";
import { getReviewContext, needsYou } from "@/lib/review";
import { PHASE_LABELS, type FilingPhase } from "@/lib/season";
import { logSensitiveView } from "@/lib/sensitive";
import { getNow, getViewer } from "@/lib/session";
import { clientsGoTo } from "@/lib/page-guards";

function delta(current: number, previous: number | undefined, label: string): { text: string; tone: Tone } | undefined {
  if (previous === undefined) return undefined;
  const d = current - previous;
  if (d === 0) return { text: "unchanged since " + label, tone: "neutral" };
  const sign = d > 0 ? "+" : "−";
  return { text: sign + fmtMoney(Math.abs(d)) + " vs " + label, tone: d > 0 ? "warn" : "ok" };
}

const PHASE_TONE: Record<FilingPhase, Tone> = { preparing: "neutral", transmitted: "accent", rejected: "danger", filed: "ok", amending: "warn", amended: "ok" };

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Meter({ label, value, total, tone, href, hint }: { label: string; value: number; total: number; tone: Tone; href: string; hint: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  const bar: Record<Tone, string> = { neutral: "bg-border-strong", accent: "bg-accent", ok: "bg-ok", warn: "bg-warn", danger: "bg-danger" };
  return (
    <Link href={href} className="group block rounded-lg px-4 py-3 transition-colors hover:bg-surface-2/60">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-muted">{pct}%</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{value}</span>
        <span className="text-[12px] text-muted">of {total}</span>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full transition-[width]", bar[tone])} style={{ width: pct + "%" }} />
      </div>
      <div className="mt-1.5 text-[11.5px] text-muted group-hover:text-foreground">{hint}</div>
    </Link>
  );
}

export default async function OverviewPage() {
  await clientsGoTo("/work");
  const { packet, index } = getPacket();
  const [{ actor, reveal }, { ledger }, review, now] = await Promise.all([getViewer(), getLedger(), getReviewContext(), getNow()]);
  const gatesOpen = review.gates.filter((g) => g.ok).length;
  const returnSignoffs = review.statuses.filter((s) => s.scope.id === "return");
  if (reveal) {
    logSensitiveView(
      actor,
      "/",
      packet.household.people.flatMap((p) => [p.ssn ? "ssn:" + p.id : null, p.ip_pin ? "ip_pin:" + p.id : null]).filter((x): x is string => Boolean(x)),
    );
  }
  const openQuestions = ledger.questions.filter((q) => !q.retracted && q.answers.every((a) => a.retracted)).slice().reverse();
  const recent = ledger.all
    .filter((f) => f.kind !== "sensitive_view" && f.kind !== "seen")
    .slice(-8)
    .reverse();
  const fmtWhen = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  const latest = index.versions.get(index.latestVersion)!;
  const prevId = index.versionOrder[index.versionOrder.length - 2];
  const prev = prevId ? index.versions.get(prevId) : undefined;
  const eff = effectiveReturn(packet, index, ledger);
  const hasWorking = eff.adjustments.length > 0;
  const ws = eff.workingSummary;
  const series = (pick: (v: typeof latest) => number) => index.versionOrder.map((id) => pick(index.versions.get(id)!));
  const pick = (w: number, e: number) => (hasWorking ? w : e);

  const docs = documentRows(index, index.latestVersion);
  const docCounts = {
    reached: docs.filter((d) => d.state === "reached").length,
    unused: docs.filter((d) => d.state === "unused").length,
    superseded: docs.filter((d) => d.state === "superseded").length,
    notExtracted: docs.filter((d) => d.state === "not_extracted").length,
  };
  const warnings = latest.diagnostics.filter((d) => d.severity === "warning");
  const infos = latest.diagnostics.filter((d) => d.severity === "info");
  const checks = runChecks(packet, index);
  const steps = requiredSteps(packet, index, ledger, {
    variances: varianceItems(packet, index, ledger, eff),
    dueDiligence: dueDiligenceItems(packet, index, ledger),
    decisions: decisionPoints(packet, index, ledger),
    documents: documentAccounting(index, ledger),
    checks,
  });
  const activeSteps = steps.filter((s) => s.auto !== "later");
  const stepsDone = activeSteps.filter((s) => s.done).length;
  const lineKeys = [...(index.lines.get(index.latestVersion)?.keys() ?? [])];
  const verifiedLines = lineKeys.filter((k) => ledger.summary(k).verifications.length > 0).length;
  const errorsOpen = checks.findings.filter((f) => f.severity === "error" && ledger.summary("check:" + f.id).total === 0).length;
  const topErrors = checks.findings
    .filter((f) => f.severity === "error")
    .sort((a, b) => Math.abs((b.effect?.federal ?? 0) + (b.effect?.california ?? 0)) - Math.abs((a.effect?.federal ?? 0) + (a.effect?.california ?? 0)))
    .slice(0, 6);
  const mine = needsYou(review, actor, new Date(now.iso)).slice(0, 6);
  const nextDeadline = [...packet.firm.deadlines].sort((a, b) => a.date.localeCompare(b.date)).find((d) => d.date >= now.iso.slice(0, 10));
  const fedBal = pick(ws.federal.balance_due, latest.summary.federal.balance_due);
  const caBal = pick(ws.california.balance_due, latest.summary.california.balance_due);

  return (
    <>
      <PageHeader
        eyebrow={filingStatusLabel(packet.household.filing_status) + " · Tax year " + packet.household.tax_year + " · " + packet.packet.client_id}
        title={packet.packet.name.replace(/ - tax year \d{4}$/, "")}
        description={"Return " + latest.version + " is current, computed " + fmtDateTime(latest.computed_at) + (hasWorking ? ", with " + eff.adjustments.length + " working adjustment" + (eff.adjustments.length === 1 ? "" : "s") + " on top." : ".")}
        meta={
          <>
            <Badge tone={PHASE_TONE[review.filing.phase]} dot>
              {PHASE_LABELS[review.filing.phase]}
            </Badge>
            <Badge tone={checks.counts.error ? "danger" : "ok"} dot>
              {checks.counts.error} check errors
            </Badge>
            <Badge tone={warnings.length ? "warn" : "ok"} dot>
              {warnings.length} engine warnings
            </Badge>
            <Badge tone={docCounts.unused ? "warn" : "ok"} dot>
              {docCounts.unused} documents reach no line
            </Badge>
          </>
        }
        actions={
          <>
            <Pill href={"/return?v=" + latest.version} primary icon={<FileSpreadsheet className="h-3.5 w-3.5" />}>
              Open return {latest.version}
            </Pill>
            <Pill href="/documents" icon={<Files className="h-3.5 w-3.5" />}>
              Documents
            </Pill>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Federal total tax"
          value={fmtMoney(pick(ws.federal.total_tax, latest.summary.federal.total_tax))}
          delta={hasWorking ? delta(ws.federal.total_tax, latest.summary.federal.total_tax, latest.version + " engine") : delta(latest.summary.federal.total_tax, prev?.summary.federal.total_tax, prevId ?? "")}
          hint={hasWorking ? "working" : undefined}
          chart={<Sparkline values={[...series((v) => v.summary.federal.total_tax), ...(hasWorking ? [ws.federal.total_tax] : [])]} className="text-accent" />}
        />
        <Stat
          label="Federal balance"
          value={
            <span className="flex items-baseline gap-1.5">
              {fmtMoney(Math.abs(fedBal))}
              <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-muted">{fedBal < 0 ? "refund" : "due"}</span>
            </span>
          }
          delta={hasWorking ? delta(ws.federal.balance_due, latest.summary.federal.balance_due, latest.version + " engine") : delta(latest.summary.federal.balance_due, prev?.summary.federal.balance_due, prevId ?? "")}
          hint={latest.summary.federal.penalty ? "incl. " + fmtMoney(latest.summary.federal.penalty) + " penalty" : undefined}
          chart={<Sparkline values={[...series((v) => v.summary.federal.balance_due), ...(hasWorking ? [ws.federal.balance_due] : [])]} className="text-accent" />}
        />
        <Stat
          label="California total tax"
          value={fmtMoney(pick(ws.california.total_tax, latest.summary.california.total_tax))}
          delta={hasWorking ? delta(ws.california.total_tax, latest.summary.california.total_tax, latest.version + " engine") : delta(latest.summary.california.total_tax, prev?.summary.california.total_tax, prevId ?? "")}
          hint={hasWorking ? "working" : undefined}
          chart={<Sparkline values={[...series((v) => v.summary.california.total_tax), ...(hasWorking ? [ws.california.total_tax] : [])]} className="text-accent" />}
        />
        <Stat
          label="California balance"
          value={
            <span className="flex items-baseline gap-1.5">
              {fmtMoney(Math.abs(caBal))}
              <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-muted">{caBal < 0 ? "refund" : "due"}</span>
            </span>
          }
          delta={hasWorking ? delta(ws.california.balance_due, latest.summary.california.balance_due, latest.version + " engine") : delta(latest.summary.california.balance_due, prev?.summary.california.balance_due, prevId ?? "")}
          tone={caBal < 0 ? "ok" : undefined}
          chart={<Sparkline values={[...series((v) => -v.summary.california.balance_due), ...(hasWorking ? [-ws.california.balance_due] : [])]} className="text-ok" />}
        />
      </div>

      {/* Where the engagement stands, and what waits on the viewer. */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Where the return stands" description="Four meters the firm's standards care about. Click one to go and move it." className="xl:col-span-2" flush>
          <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            <Meter label="Lines verified" value={verifiedLines} total={lineKeys.length} tone="accent" href={"/return?v=" + latest.version} hint="agreed to a source, recalculated or confirmed" />
            <Meter label="Check errors dealt with" value={checks.counts.error - errorsOpen} total={checks.counts.error} tone={errorsOpen ? "danger" : "ok"} href="/checks?severity=error" hint={errorsOpen ? errorsOpen + " still open" : "every error corrected or explained"} />
            <Meter label="Required steps" value={stepsDone} total={activeSteps.length} tone={stepsDone === activeSteps.length ? "ok" : "warn"} href="/completeness" hint={steps.length - activeSteps.length + " more come with review"} />
            <Meter label="Filing gates open" value={gatesOpen} total={review.gates.length} tone={gatesOpen === review.gates.length ? "ok" : "neutral"} href="/filing" hint={PHASE_LABELS[review.filing.phase].toLowerCase()} />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-5 py-3 text-[12.5px]">
            {returnSignoffs.map((s) => (
              <span key={s.level} className="inline-flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", s.state === "valid" ? "bg-ok" : s.state === "reopened" ? "bg-warn" : "bg-border-strong")} />
                <span className="capitalize text-muted">{s.level}</span>
                <span className="font-medium">{s.state === "valid" ? s.fact?.actorName : s.state === "reopened" ? "reopened" : "not signed"}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", review.client.complete ? "bg-ok" : review.client.request ? "bg-accent" : "bg-border-strong")} />
              <span className="text-muted">Client</span>
              <span className="font-medium">{review.client.complete ? "both signed" : review.client.request ? "sent for approval" : "not sent"}</span>
            </span>
            <Link href="/review" className="ml-auto inline-flex items-center gap-1 text-[12px] text-accent hover:underline">
              Sign-off matrix <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><Inbox className="h-4 w-4 text-warn" /> Needs you</span>}
          description={mine.length ? "Derived from the ledger and the firm's rules." : "Nothing is waiting on you right now."}
          aside={
            <Link href="/work" className="text-accent hover:underline">
              My work
            </Link>
          }
          flush={mine.length > 0}
        >
          {mine.length === 0 ? (
            <Empty>
              <Check className="mx-auto mb-1 h-4 w-4 text-ok" />
              All clear for {actor.name.split(" ")[0]}.
            </Empty>
          ) : (
            <ul className="divide-y divide-border">
              {mine.map((item, i) => (
                <li key={i}>
                  <Link href={item.href} className="flex items-start gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2/60">
                    <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", item.overdue ? "bg-danger" : item.kind === "blocking" || item.kind === "filing" ? "bg-warn" : "bg-accent")} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{item.title}</span>
                      <span className="block truncate text-[11.5px] text-muted">{item.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <SectionTitle className="mb-3 mt-8">The return</SectionTitle>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Return versions" description="Each engine run, what triggered it, and how much moved." className="xl:col-span-2" flush>
          <table className="tbl">
            <thead>
              <tr>
                <th>Version</th>
                <th>Computed</th>
                <th>Trigger</th>
                <th className="num">Docs</th>
                <th className="num">Lines moved</th>
                <th className="num">Federal</th>
                <th className="num">California</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {index.versionOrder.map((vid) => {
                const v = index.versions.get(vid)!;
                const isLatest = vid === index.latestVersion;
                return (
                  <tr key={vid} className={cn(isLatest && "bg-surface-2/40")}>
                    <td className="font-medium">
                      <span className="flex items-center gap-2">
                        <span className="font-mono">{vid}</span>
                        {isLatest ? (
                          <Badge tone="accent" dot>
                            current
                          </Badge>
                        ) : null}
                      </span>
                    </td>
                    <td className="whitespace-nowrap tabular-nums text-muted">{fmtDate(v.computed_at)}</td>
                    <td className="max-w-md text-muted" title={v.trigger}>
                      <span className="line-clamp-1">{v.trigger}</span>
                    </td>
                    <td className="num">{v.documents_used.length}</td>
                    <td className="num">{v.changes_from_previous.length || <span className="text-border-strong">—</span>}</td>
                    <td className="num">{fmtBalance(v.summary.federal.balance_due)}</td>
                    <td className="num">{fmtBalance(v.summary.california.balance_due)}</td>
                    <td className="text-right">
                      <Link href={"/return?v=" + vid} className="inline-flex items-center gap-0.5 text-[12px] text-accent hover:underline">
                        Open <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {hasWorking ? (
                <tr className="bg-accent-soft/30">
                  <td className="font-medium">
                    <span className="flex items-center gap-2">
                      <span className="font-mono">working</span>
                      <Badge tone="accent">{eff.adjustments.length} adj.</Badge>
                    </span>
                  </td>
                  <td className="text-muted">now</td>
                  <td className="text-muted">{latest.version} plus every active adjustment</td>
                  <td className="num">{latest.documents_used.length}</td>
                  <td className="num">{eff.changed.length}</td>
                  <td className="num">{fmtBalance(ws.federal.balance_due)}</td>
                  <td className="num">{fmtBalance(ws.california.balance_due)}</td>
                  <td className="text-right">
                    <Link href="/return?v=working" className="inline-flex items-center gap-0.5 text-[12px] text-accent hover:underline">
                      Open <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>

        <Card title="Household" description="As the client entered it in the organizer.">
          <ul className="grid gap-3">
            {packet.household.people.map((p) => (
              <li key={p.id} className="flex items-start gap-3">
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold", p.role === "dependent" ? "bg-surface-2 text-muted" : "bg-accent-soft text-accent")}>{initials(p.name)}</span>
                <div className="min-w-0 flex-1">
                  <RefLink refId={"household:" + p.id} plain className="font-medium text-foreground">
                    {p.name}
                  </RefLink>
                  <div className="text-[12px] text-muted">
                    {(p.relationship ?? p.role) + " · born " + fmtDate(p.dob)}
                    {p.full_time_student ? " · student" : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right font-mono text-[11px] leading-4 text-muted">
                  <div>{p.ssn ? (reveal ? p.ssn : maskSsn(p.ssn)) : "no SSN"}</div>
                  {p.ip_pin ? <div>IP PIN {reveal ? p.ip_pin : maskPin()}</div> : null}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-border pt-3">
            <KV
              className="text-[12.5px]"
              rows={[
                ["Residency", packet.household.residency.map((r) => r.state + " · " + fmtDate(r.from) + " to " + fmtDate(r.to)).join("; ")],
                ["2024 AGI", fmtMoney(packet.household.prior_year_agi_for_esignature)],
              ]}
            />
          </div>
        </Card>

        <Card
          title="Workpaper checks"
          description={checks.counts.checks + " independent recomputations that trust neither the engine nor the extractor. The largest errors by tax effect:"}
          aside={
            <Link href="/checks" className="text-accent hover:underline">
              All findings
            </Link>
          }
          className="xl:col-span-2"
          flush
        >
          <div className="flex flex-wrap gap-4 border-b border-border px-5 py-2.5 text-[12px]">
            <span>
              <span className="font-semibold text-danger">{checks.counts.error}</span> <span className="text-muted">errors</span>
            </span>
            <span>
              <span className="font-semibold text-warn">{checks.counts.warning}</span> <span className="text-muted">warnings</span>
            </span>
            <span>
              <span className="font-semibold text-ok">{checks.counts.clean}</span> <span className="text-muted">clean checks</span>
            </span>
          </div>
          {topErrors.length === 0 ? (
            <div className="p-5">
              <Empty>Every check passes.</Empty>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {topErrors.map((f) => (
                <li key={f.id}>
                  <Link href={"/checks/" + encodeURIComponent(f.id)} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2/60">
                    <SeverityIcon severity={f.severity} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{f.title}</span>
                    <EffectBadge effect={f.effect} />
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Documents"
          description={"Where the " + docs.length + " documents stand against " + latest.version + "."}
          aside={
            <Link href="/documents" className="text-accent hover:underline">
              Open index
            </Link>
          }
        >
          <StackedBar
            total={docs.length}
            parts={[
              { label: "on the return", value: docCounts.reached, tone: "ok" },
              { label: "reach no line", value: docCounts.unused, tone: "warn" },
              { label: "not extracted", value: docCounts.notExtracted, tone: "danger" },
              { label: "superseded", value: docCounts.superseded, tone: "neutral" },
            ]}
          />
          <div className="mt-4 border-t border-border pt-3">
            <KV
              className="text-[12.5px]"
              rows={[
                ["Extracted values", fmtNumber(packet.extracted_values.length)],
                [
                  "Reach no line",
                  <span key="u" className="flex flex-wrap gap-1">
                    {docs
                      .filter((d) => d.state === "unused")
                      .map((d) => (
                        <RefLink key={d.id} refId={d.id} />
                      ))}
                  </span>,
                ],
              ]}
            />
          </div>
        </Card>
      </div>

      <SectionTitle className="mb-3 mt-8">Activity</SectionTitle>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          title="Working adjustments"
          description={hasWorking ? eff.adjustments.length + " change" + (eff.adjustments.length === 1 ? "" : "s") + " applied on top of " + latest.version + "; " + eff.changed.length + " lines differ." : "Corrections recorded on top of the engine's figures. None yet."}
          aside={
            <Link href={"/compare?a=" + latest.version + "&b=working"} className="text-accent hover:underline">
              Compare
            </Link>
          }
        >
          {hasWorking ? (
            <ul className="grid gap-3">
              {eff.adjustments
                .slice(-6)
                .reverse()
                .map((a) => (
                  <li key={a.factId} className="text-[13px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <RefLink refId={a.key} />
                      <span className="font-mono text-[12px] tabular-nums">
                        <span className="text-muted line-through">{fmtNumber(a.engineValue)}</span> <ArrowRight className="inline h-3 w-3 text-muted" /> <span className="font-semibold">{fmtNumber(a.newValue)}</span>
                      </span>
                      <EffectBadge effect={{ federal: a.effect.federal, california: a.effect.california }} />
                      {a.requiresPartner ? <Badge tone="warn">partner</Badge> : null}
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-[12px] text-muted">
                      {a.actorName}: {a.reason}
                    </div>
                  </li>
                ))}
            </ul>
          ) : (
            <Empty>Open a line, or a check finding, to record a correction.</Empty>
          )}
        </Card>

        <Card
          title="Open questions"
          description="Answers land on the item they were asked about."
          aside={
            <Link href="/questions" className="text-accent hover:underline">
              All questions
            </Link>
          }
        >
          {openQuestions.length === 0 ? (
            <Empty>Nothing is waiting on anyone.</Empty>
          ) : (
            <ul className="grid gap-3">
              {openQuestions.slice(0, 5).map((q) => (
                <li key={q.id} className="text-[13px]">
                  <div className="line-clamp-2 leading-5">{String(q.body.text ?? "")}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted">
                    <span>to {q.body.to === "client" ? "the client" : String(q.body.to)}</span>
                    <span>·</span>
                    <RefLink refId={q.target} />
                  </div>
                </li>
              ))}
              {openQuestions.length > 5 ? <li className="text-[12px] text-muted">and {openQuestions.length - 5} more</li> : null}
            </ul>
          )}
        </Card>

        <Card
          title="Recent activity"
          aside={
            actor.kind === "staff" ? (
              <Link href="/activity" className="text-accent hover:underline">
                Full ledger
              </Link>
            ) : undefined
          }
          flush={recent.length > 0}
        >
          {recent.length === 0 ? (
            <Empty>No one has recorded anything yet.</Empty>
          ) : (
            <ul className="divide-y divide-border/70">
              {recent.map((f) => (
                <li key={f.id} className="flex items-start gap-3 px-5 py-2">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-[9.5px] font-semibold text-muted">{initials(f.actorName)}</span>
                  <span className="min-w-0 flex-1 text-[12.5px] leading-5">
                    <span className="font-medium">{f.actorName}</span> <span className="text-muted">{(KIND_LABELS[f.kind as FactKind] ?? f.kind).toLowerCase()}</span> <RefLink refId={f.target} />
                  </span>
                  <span className="shrink-0 font-mono text-[10.5px] text-muted">{fmtWhen.format(new Date(f.at))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title={"Engine diagnostics · " + latest.version}
          description="What the computation engine flagged, in its own words."
          aside={warnings.length + " warnings · " + infos.length + " info"}
          className="xl:col-span-2"
          flush
        >
          <ul className="divide-y divide-border">
            {latest.diagnostics.map((d) => (
              <li key={d.code + d.message} className="flex gap-3 px-5 py-2.5">
                <SeverityIcon severity={d.severity === "warning" ? "warning" : "info"} className="mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[13px] leading-5">{d.message}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10.5px] text-muted">{d.code}</span>
                    {d.refs.map((r) => (
                      <RefLink key={r} refId={r} />
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="grid content-start gap-4">
          <Card
            title="Deadlines"
            description={nextDeadline ? "Next: " + nextDeadline.what : "Every deadline has passed."}
            aside={
              <Link href="/timeline" className="text-accent hover:underline">
                Timeline
              </Link>
            }
          >
            <ul className="grid gap-2 text-[13px]">
              {[...packet.firm.deadlines]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((d) => {
                  const past = d.date < now.iso.slice(0, 10);
                  return (
                    <li key={d.what} className={cn("flex items-baseline justify-between gap-3", past && "text-muted")}>
                      <span className="min-w-0 leading-snug">{d.what}</span>
                      <span className={cn("shrink-0 font-mono text-[11.5px] tabular-nums", past ? "text-muted line-through decoration-border-strong" : d === nextDeadline ? "text-warn" : "text-muted")}>{fmtDate(d.date)}</span>
                    </li>
                  );
                })}
            </ul>
          </Card>

          <Card title="Try a trace" description="Any id from the packet opens as a record with its links.">
            <div className="flex flex-wrap gap-1.5">
              {["F1040.11", "SchC.1", "F8949.B.N1", "ev-0703", "D30", "D31", "D10", "qa-14", "asset:SAC-BLDG", "tl-21"].map((r) => (
                <RefLink key={r} refId={r} />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
