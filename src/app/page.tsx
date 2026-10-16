import { ArrowUpRight, Files, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Sparkline } from "@/components/sparkline";
import { Badge, Card, Empty, KV, Pill, StackedBar, Stat, type Tone } from "@/components/ui";
import { filingStatusLabel, fmtBalance, fmtDate, fmtDateTime, fmtMoney, fmtNumber } from "@/lib/format";
import { maskPin, maskSsn } from "@/lib/mask";
import { EffectBadge } from "@/components/checks/finding-row";
import { runChecks } from "@/lib/checks/run";
import { getLedger } from "@/lib/facts/repo";
import { KIND_LABELS, type FactKind } from "@/lib/facts/types";
import { documentRows } from "@/lib/packet/documents";
import { getPacket } from "@/lib/packet/load";
import { logSensitiveView } from "@/lib/sensitive";
import { getViewer } from "@/lib/session";

function delta(current: number, previous: number | undefined, label: string): { text: string; tone: Tone } | undefined {
  if (previous === undefined) return undefined;
  const d = current - previous;
  if (d === 0) return { text: "unchanged since " + label, tone: "neutral" };
  const sign = d > 0 ? "+" : "−";
  return { text: sign + fmtMoney(Math.abs(d)) + " vs " + label, tone: d > 0 ? "warn" : "ok" };
}

export default async function OverviewPage() {
  const { packet, index } = getPacket();
  const [{ actor, reveal }, { ledger }] = await Promise.all([getViewer(), getLedger()]);
  if (reveal) {
    logSensitiveView(
      actor,
      "/",
      packet.household.people.flatMap((p) => [p.ssn ? "ssn:" + p.id : null, p.ip_pin ? "ip_pin:" + p.id : null]).filter((x): x is string => Boolean(x)),
    );
  }
  const openQuestions = ledger.questions.filter((q) => !q.retracted && q.answers.every((a) => a.retracted)).slice().reverse();
  const recent = ledger.all
    .filter((f) => f.kind !== "sensitive_view")
    .slice(-8)
    .reverse();
  const fmtWhen = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  const latest = index.versions.get(index.latestVersion)!;
  const prevId = index.versionOrder[index.versionOrder.length - 2];
  const prev = prevId ? index.versions.get(prevId) : undefined;
  const series = (pick: (v: typeof latest) => number) => index.versionOrder.map((id) => pick(index.versions.get(id)!));

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
  const topErrors = checks.findings
    .filter((f) => f.severity === "error")
    .sort((a, b) => Math.abs((b.effect?.federal ?? 0) + (b.effect?.california ?? 0)) - Math.abs((a.effect?.federal ?? 0) + (a.effect?.california ?? 0)))
    .slice(0, 6);

  return (
    <>
      <PageHeader
        eyebrow={filingStatusLabel(packet.household.filing_status) + " · Tax year " + packet.household.tax_year + " · " + packet.packet.client_id}
        title={packet.packet.name.replace(/ - tax year \d{4}$/, "")}
        description={"Return " + latest.version + " is current, computed " + fmtDateTime(latest.computed_at) + "."}
        meta={
          <>
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
          value={fmtMoney(latest.summary.federal.total_tax)}
          delta={delta(latest.summary.federal.total_tax, prev?.summary.federal.total_tax, prevId ?? "")}
          chart={<Sparkline values={series((v) => v.summary.federal.total_tax)} className="text-accent" />}
        />
        <Stat
          label="Federal balance due"
          value={fmtBalance(latest.summary.federal.balance_due)}
          delta={delta(latest.summary.federal.balance_due, prev?.summary.federal.balance_due, prevId ?? "")}
          hint={latest.summary.federal.penalty ? "incl. " + fmtMoney(latest.summary.federal.penalty) + " penalty" : undefined}
          chart={<Sparkline values={series((v) => v.summary.federal.balance_due)} className="text-accent" />}
        />
        <Stat
          label="California total tax"
          value={fmtMoney(latest.summary.california.total_tax)}
          delta={delta(latest.summary.california.total_tax, prev?.summary.california.total_tax, prevId ?? "")}
          chart={<Sparkline values={series((v) => v.summary.california.total_tax)} className="text-accent" />}
        />
        <Stat
          label="California balance"
          value={fmtBalance(latest.summary.california.balance_due)}
          delta={delta(latest.summary.california.balance_due, prev?.summary.california.balance_due, prevId ?? "")}
          tone={latest.summary.california.balance_due < 0 ? "ok" : undefined}
          chart={<Sparkline values={series((v) => -v.summary.california.balance_due)} className="text-ok" />}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card
          title="Return versions"
          description="Each engine run, what triggered it, and how much moved."
          className="xl:col-span-2"
          flush
        >
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
                  <tr key={vid}>
                    <td className="font-medium">
                      <span className="flex items-center gap-2">
                        {vid}
                        {isLatest ? (
                          <Badge tone="accent" dot>
                            current
                          </Badge>
                        ) : null}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-muted">{fmtDate(v.computed_at)}</td>
                    <td className="max-w-md text-muted" title={v.trigger}>
                      <span className="line-clamp-1">{v.trigger}</span>
                    </td>
                    <td className="num">{v.documents_used.length}</td>
                    <td className="num">{v.changes_from_previous.length || "—"}</td>
                    <td className="num">{fmtBalance(v.summary.federal.balance_due)}</td>
                    <td className="num">{fmtBalance(v.summary.california.balance_due)}</td>
                    <td className="text-right">
                      <Link href={"/return?v=" + vid} className="inline-flex items-center gap-0.5 text-accent hover:underline">
                        Open <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title="Household" description="As the client entered it in the organizer.">
          <ul className="grid gap-3">
            {packet.household.people.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
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
              rows={[
                ["Residency", packet.household.residency.map((r) => r.state + " · " + fmtDate(r.from) + " to " + fmtDate(r.to)).join("; ")],
                ["2024 AGI", fmtMoney(packet.household.prior_year_agi_for_esignature)],
              ]}
            />
          </div>
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
              rows={[
                ["Extracted values", fmtNumber(packet.extracted_values.length)],
                [
                  "Reach no line",
                  <span key="u" className="flex flex-wrap gap-x-2 gap-y-0.5">
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
            <ul className="grid gap-2.5">
              {openQuestions.slice(0, 5).map((q) => (
                <li key={q.id} className="text-[13px]">
                  <div className="line-clamp-2">{String(q.body.text ?? "")}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted">
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
        >
          {recent.length === 0 ? (
            <Empty>No one has recorded anything yet.</Empty>
          ) : (
            <ul className="grid gap-2">
              {recent.map((f) => (
                <li key={f.id} className="flex items-baseline gap-2 text-[12.5px]">
                  <span className="shrink-0 font-mono text-[11px] text-muted">{fmtWhen.format(new Date(f.at))}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{f.actorName}</span>{" "}
                    <span className="text-muted">{(KIND_LABELS[f.kind as FactKind] ?? f.kind).toLowerCase()}</span> <RefLink refId={f.target} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Deadlines">
          <ul className="grid gap-2 text-[13px]">
            {[...packet.firm.deadlines]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((d) => (
                <li key={d.what} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 leading-snug">{d.what}</span>
                  <span className="shrink-0 font-mono text-[11.5px] text-muted">{fmtDate(d.date)}</span>
                </li>
              ))}
          </ul>
        </Card>

        <Card title="Try a trace" description="Any id from the packet opens as a record with its links.">
          <div className="flex flex-wrap gap-1.5">
            {["F1040.11", "SchC.1", "F8949.B.N1", "ev-0703", "D30", "D31", "D10", "qa-14", "asset:SAC-BLDG", "tl-21"].map((r) => (
              <RefLink key={r} refId={r} className="rounded-full border border-border bg-surface px-2.5 py-1 hover:border-border-strong hover:bg-surface-2 hover:no-underline">
                {r}
              </RefLink>
            ))}
          </div>
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
              <li key={d.code + d.message} className="flex gap-3 px-4 py-2.5">
                <span className={"mt-1.5 h-2 w-2 shrink-0 rounded-full " + (d.severity === "warning" ? "bg-warn" : "bg-border-strong")} />
                <div className="min-w-0">
                  <div className="text-[13px]">{d.message}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="font-mono text-[11px] text-muted">{d.code}</span>
                    {d.refs.map((r) => (
                      <RefLink key={r} refId={r} />
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Workpaper checks"
          description={checks.counts.checks + " independent recomputations that trust neither the engine nor the extractor."}
          aside={
            <Link href="/checks" className="text-accent hover:underline">
              All findings
            </Link>
          }
          flush
        >
          <div className="flex gap-4 border-b border-border px-4 py-2.5 text-[12px]">
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
            <div className="p-4">
              <Empty>Every check passes.</Empty>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {topErrors.map((f) => (
                <li key={f.id} className="px-4 py-2.5">
                  <Link href={"/checks/" + encodeURIComponent(f.id)} className="text-[13px] hover:underline">
                    {f.title}
                  </Link>
                  <div className="mt-0.5">
                    <EffectBadge effect={f.effect} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
