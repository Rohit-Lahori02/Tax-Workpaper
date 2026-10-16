import { LookupBox } from "@/components/lookup-box";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, Empty, KV, numClass, tableClass } from "@/components/ui";
import { filingStatusLabel, fmtBalance, fmtDate, fmtDateTime, fmtMoney, fmtNumber } from "@/lib/format";
import { maskPin, maskSsn } from "@/lib/mask";
import { getPacket } from "@/lib/packet/load";
import { canViewSensitive } from "@/lib/roles";
import { getCurrentActor } from "@/lib/session";

export default async function OverviewPage() {
  const { packet, index } = getPacket();
  const actor = await getCurrentActor();
  const reveal = canViewSensitive(actor);
  const latest = index.versions.get(index.latestVersion)!;

  const docCounts = { extracted: 0, partial: 0, not_extracted: 0 };
  for (const d of packet.documents) docCounts[d.extraction.status] += 1;
  const warnings = latest.diagnostics.filter((d) => d.severity === "warning");
  const infos = latest.diagnostics.filter((d) => d.severity === "info");
  const integrityWarnings = index.integrity.filter((i) => i.severity === "warning");

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{packet.packet.name}</h1>
          <p className="text-sm text-muted">
            {filingStatusLabel(packet.household.filing_status)}, tax year {packet.household.tax_year}. Current return{" "}
            {latest.version}, computed {fmtDateTime(latest.computed_at)}.
          </p>
        </div>
        <LookupBox />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Return at a glance" className="lg:col-span-2">
          <table className={tableClass}>
            <thead>
              <tr>
                <th>Version</th>
                <th>Computed</th>
                <th className={numClass}>Federal tax</th>
                <th className={numClass}>Federal balance</th>
                <th className={numClass}>California tax</th>
                <th className={numClass}>California balance</th>
              </tr>
            </thead>
            <tbody>
              {index.versionOrder.map((vid) => {
                const v = index.versions.get(vid)!;
                const isLatest = vid === index.latestVersion;
                return (
                  <tr key={vid} className={isLatest ? "font-medium" : "text-muted"}>
                    <td>
                      {vid} {isLatest ? <Badge tone="accent">current</Badge> : null}
                    </td>
                    <td>{fmtDate(v.computed_at)}</td>
                    <td className={numClass}>{fmtMoney(v.summary.federal.total_tax)}</td>
                    <td className={numClass}>{fmtBalance(v.summary.federal.balance_due)}</td>
                    <td className={numClass}>{fmtMoney(v.summary.california.total_tax)}</td>
                    <td className={numClass}>{fmtBalance(v.summary.california.balance_due)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-muted">{latest.trigger}</p>
        </Card>

        <Card title="Household">
          <ul className="grid gap-2 text-sm">
            {packet.household.people.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span>
                  <RefLink refId={"household:" + p.id} className="font-sans">
                    {p.name}
                  </RefLink>{" "}
                  <span className="text-muted">{p.relationship ?? p.role}</span>
                </span>
                <span className="font-mono text-xs text-muted">
                  {p.ssn ? (reveal ? p.ssn : maskSsn(p.ssn)) : "no SSN"}
                  {p.ip_pin ? " · IP PIN " + (reveal ? p.ip_pin : maskPin()) : ""}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-border pt-3">
            <KV
              rows={[
                ["Residency", packet.household.residency.map((r) => r.state + " " + fmtDate(r.from) + " to " + fmtDate(r.to)).join("; ")],
                ["Prior-year AGI", fmtMoney(packet.household.prior_year_agi_for_esignature)],
              ]}
            />
          </div>
        </Card>

        <Card title="What is in the packet">
          <KV
            rows={[
              [
                "Documents",
                fmtNumber(packet.documents.length) +
                  " (" +
                  docCounts.extracted +
                  " extracted, " +
                  docCounts.partial +
                  " partial, " +
                  docCounts.not_extracted +
                  " not extracted)",
              ],
              ["Extracted values", fmtNumber(packet.extracted_values.length)],
              ["Return lines in " + latest.version, fmtNumber(latest.lines.length)],
              ["Return versions", index.versionOrder.join(", ")],
              ["Assets", fmtNumber(latest.assets.length)],
              [
                "Client answers",
                packet.client.questionnaire.length + " questionnaire, " + packet.client.messages.length + " messages, " + packet.client.call_notes.length + " call",
              ],
              ["Timeline events", fmtNumber(packet.timeline.length)],
              ["Staff", fmtNumber(packet.firm.staff.length)],
            ]}
          />
        </Card>

        <Card title="Deadlines">
          <ul className="grid gap-1 text-sm">
            {[...packet.firm.deadlines]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((d) => (
                <li key={d.what} className="flex justify-between gap-3">
                  <span>{d.what}</span>
                  <span className="shrink-0 tabular-nums text-muted">{fmtDate(d.date)}</span>
                </li>
              ))}
          </ul>
        </Card>

        <Card title="Try a trace">
          <p className="mb-2 text-sm text-muted">Any id from the packet opens as a record with its links.</p>
          <div className="flex flex-wrap gap-2 text-sm">
            {["F1040.11", "SchC.1", "ev-0703", "D30", "D31", "qa-14", "asset:SAC-BLDG", "py:/carryovers_into_2025", "tl-21"].map((r) => (
              <RefLink key={r} refId={r} className="rounded border border-border px-2 py-0.5 text-xs">
                {r}
              </RefLink>
            ))}
          </div>
        </Card>

        <Card
          title={"Engine diagnostics (" + latest.version + ")"}
          aside={
            <span className="text-xs text-muted">
              {warnings.length} warnings, {infos.length} info
            </span>
          }
          className="lg:col-span-2"
        >
          <ul className="grid gap-2 text-sm">
            {latest.diagnostics.map((d) => (
              <li key={d.code + d.message} className="grid gap-0.5">
                <div className="flex items-center gap-2">
                  <Badge tone={d.severity === "warning" ? "warn" : "neutral"}>{d.code}</Badge>
                </div>
                <p>{d.message}</p>
                <p className="flex flex-wrap gap-x-2 text-xs">
                  {d.refs.map((r) => (
                    <RefLink key={r} refId={r} />
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Packet integrity checks"
          aside={<span className="text-xs text-muted">{integrityWarnings.length} warnings</span>}
        >
          <p className="mb-2 text-sm text-muted">
            Independent of the engine: every reference in the packet must land somewhere, and counts must agree.
          </p>
          {index.integrity.length === 0 ? (
            <Empty>No dangling references or count mismatches found.</Empty>
          ) : (
            <ul className="grid gap-2 text-sm">
              {index.integrity.map((i, n) => (
                <li key={n} className="grid gap-0.5">
                  <Badge tone={i.severity === "warning" ? "warn" : "neutral"}>{i.code}</Badge>
                  <p>{i.message}</p>
                  <p className="flex flex-wrap gap-x-2 text-xs">
                    {i.refs.map((r) => (
                      <RefLink key={r} refId={r} />
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
