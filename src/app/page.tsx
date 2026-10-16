import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, Empty, KV, Stat, type Tone } from "@/components/ui";
import { filingStatusLabel, fmtBalance, fmtDate, fmtDateTime, fmtMoney, fmtNumber } from "@/lib/format";
import { maskPin, maskSsn } from "@/lib/mask";
import { getPacket } from "@/lib/packet/load";
import { canViewSensitive } from "@/lib/roles";
import { getCurrentActor } from "@/lib/session";

function delta(current: number, previous: number | undefined, label: string): { text: string; tone: Tone } | undefined {
  if (previous === undefined) return undefined;
  const d = current - previous;
  if (d === 0) return { text: "unchanged since " + label, tone: "neutral" };
  const sign = d > 0 ? "+" : "−";
  return { text: sign + fmtMoney(Math.abs(d)) + " since " + label, tone: d > 0 ? "warn" : "ok" };
}

export default async function OverviewPage() {
  const { packet, index } = getPacket();
  const actor = await getCurrentActor();
  const reveal = canViewSensitive(actor);
  const latest = index.versions.get(index.latestVersion)!;
  const prevId = index.versionOrder[index.versionOrder.length - 2];
  const prev = prevId ? index.versions.get(prevId) : undefined;

  const docCounts = { extracted: 0, partial: 0, not_extracted: 0 };
  for (const d of packet.documents) docCounts[d.extraction.status] += 1;
  const attention = packet.documents.filter((d) => {
    const u = index.documentUsage.get(d.id)!;
    const reached = u.linesReached.some((l) => l.version === index.latestVersion);
    const superseded = u.supersededIn.length > 0;
    return !superseded && !reached;
  });
  const warnings = latest.diagnostics.filter((d) => d.severity === "warning");
  const infos = latest.diagnostics.filter((d) => d.severity === "info");
  const integrityWarnings = index.integrity.filter((i) => i.severity === "warning");

  return (
    <>
      <PageHeader
        eyebrow={filingStatusLabel(packet.household.filing_status) + " · Tax year " + packet.household.tax_year}
        title={packet.packet.name.replace(/ - tax year \d{4}$/, "")}
        description={
          "Return " + latest.version + " is current, computed " + fmtDateTime(latest.computed_at) + ". " + latest.trigger
        }
        meta={
          <>
            <Badge tone="accent">{index.versionOrder.length} versions</Badge>
            <Badge tone={warnings.length ? "warn" : "ok"}>{warnings.length} engine warnings</Badge>
            <Badge tone={attention.length ? "warn" : "ok"}>{attention.length} documents reach no line</Badge>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Federal total tax"
          value={fmtMoney(latest.summary.federal.total_tax)}
          delta={delta(latest.summary.federal.total_tax, prev?.summary.federal.total_tax, prevId ?? "")}
        />
        <Stat
          label="Federal balance due"
          value={fmtBalance(latest.summary.federal.balance_due)}
          delta={delta(latest.summary.federal.balance_due, prev?.summary.federal.balance_due, prevId ?? "")}
          hint={latest.summary.federal.penalty ? "penalty " + fmtMoney(latest.summary.federal.penalty) : undefined}
        />
        <Stat
          label="California total tax"
          value={fmtMoney(latest.summary.california.total_tax)}
          delta={delta(latest.summary.california.total_tax, prev?.summary.california.total_tax, prevId ?? "")}
        />
        <Stat
          label="California balance"
          value={fmtBalance(latest.summary.california.balance_due)}
          delta={delta(latest.summary.california.balance_due, prev?.summary.california.balance_due, prevId ?? "")}
          tone={latest.summary.california.balance_due < 0 ? "ok" : undefined}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card
          title="Return versions"
          description="Each engine run, what triggered it, and how much moved."
          className="lg:col-span-2"
          flush
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Version</th>
                <th>Computed</th>
                <th>Trigger</th>
                <th className="num">Documents</th>
                <th className="num">Lines changed</th>
                <th className="num">Federal balance</th>
                <th className="num">California balance</th>
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
                      {vid} {isLatest ? <Badge tone="accent">current</Badge> : null}
                    </td>
                    <td className="whitespace-nowrap text-muted">{fmtDate(v.computed_at)}</td>
                    <td className="max-w-md text-muted" title={v.trigger}>
                      <span className="line-clamp-2">{v.trigger}</span>
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
          <ul className="grid gap-2.5">
            {packet.household.people.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <RefLink refId={"household:" + p.id} plain className="font-medium text-foreground">
                    {p.name}
                  </RefLink>
                  <div className="text-xs text-muted">
                    {(p.relationship ?? p.role) + " · born " + fmtDate(p.dob)}
                    {p.full_time_student ? " · student" : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right font-mono text-[11px] text-muted">
                  <div>{p.ssn ? (reveal ? p.ssn : maskSsn(p.ssn)) : "no SSN"}</div>
                  {p.ip_pin ? <div>IP PIN {reveal ? p.ip_pin : maskPin()}</div> : null}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-border pt-3">
            <KV
              rows={[
                [
                  "Residency",
                  packet.household.residency.map((r) => r.state + " " + fmtDate(r.from) + " – " + fmtDate(r.to)).join(" · "),
                ],
                ["2024 AGI", fmtMoney(packet.household.prior_year_agi_for_esignature)],
              ]}
            />
          </div>
        </Card>

        <Card
          title="Documents"
          description="Where the 74 documents stand against the current return."
          aside={
            <Link href="/documents" className="text-accent hover:underline">
              Open index
            </Link>
          }
        >
          <KV
            rows={[
              ["Extracted", fmtNumber(docCounts.extracted)],
              ["Partially extracted", fmtNumber(docCounts.partial)],
              ["Not extracted", fmtNumber(docCounts.not_extracted)],
              ["Extracted values", fmtNumber(packet.extracted_values.length)],
              [
                "Reach no line in " + latest.version,
                attention.length ? (
                  <span className="flex flex-wrap gap-1">
                    {attention.map((d) => (
                      <RefLink key={d.id} refId={d.id} />
                    ))}
                  </span>
                ) : (
                  "none"
                ),
              ],
            ]}
          />
        </Card>

        <Card title="Deadlines">
          <ul className="grid gap-1.5 text-[13px]">
            {[...packet.firm.deadlines]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((d) => (
                <li key={d.what} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">{d.what}</span>
                  <span className="shrink-0 font-mono text-xs text-muted">{fmtDate(d.date)}</span>
                </li>
              ))}
          </ul>
        </Card>

        <Card title="Try a trace" description="Any id from the packet opens as a record with its links.">
          <div className="flex flex-wrap gap-1.5">
            {["F1040.11", "SchC.1", "F8949.B.N1", "ev-0703", "D30", "D31", "D10", "qa-14", "asset:SAC-BLDG", "tl-21"].map((r) => (
              <RefLink key={r} refId={r} className="rounded-md border border-border bg-surface-2 px-2 py-1 hover:bg-accent-soft hover:no-underline">
                {r}
              </RefLink>
            ))}
          </div>
        </Card>

        <Card
          title={"Engine diagnostics · " + latest.version}
          description="What the computation engine flagged. These are the engine's own words; the workpaper's checks are separate."
          aside={warnings.length + " warnings · " + infos.length + " info"}
          className="lg:col-span-2"
          flush
        >
          <ul className="divide-y divide-border">
            {latest.diagnostics.map((d) => (
              <li key={d.code + d.message} className="grid gap-1 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={d.severity === "warning" ? "warn" : "neutral"} mono>
                    {d.code}
                  </Badge>
                  <span className="text-[13px]">{d.message}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {d.refs.map((r) => (
                    <RefLink key={r} refId={r} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Packet integrity"
          description="Checks that trust neither the engine nor the extractor: every reference must land, every count must agree."
          aside={integrityWarnings.length + " warnings"}
          flush
        >
          {index.integrity.length === 0 ? (
            <div className="p-4">
              <Empty>Every reference in the packet resolves and every count agrees.</Empty>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {index.integrity.map((i, n) => (
                <li key={n} className="grid gap-1 px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={i.severity === "warning" ? "warn" : "neutral"} mono>
                      {i.code}
                    </Badge>
                  </div>
                  <p className="text-[13px]">{i.message}</p>
                  <div className="flex flex-wrap gap-x-3">
                    {i.refs.map((r) => (
                      <RefLink key={r} refId={r} />
                    ))}
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
