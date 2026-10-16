import type { Metadata } from "next";
import { FindingRow } from "@/components/checks/finding-row";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, KV, Stat } from "@/components/ui";
import { runChecks } from "@/lib/checks/run";
import { residentDays } from "@/lib/checks/state";
import { makeContext } from "@/lib/checks/run";
import { getLedger } from "@/lib/facts/repo";
import { fmtDate, fmtLineValue, fmtMoney, fmtPct } from "@/lib/format";
import { getPacket } from "@/lib/packet/load";
import type { ReturnLine } from "@/lib/packet/schema";
import { lineHref } from "@/lib/refs";

export const metadata: Metadata = { title: "California split" };

const COLS = ["A", "B", "C", "D", "E"] as const;
const COL_LABELS: Record<(typeof COLS)[number], string> = {
  A: "Federal",
  B: "CA subtractions",
  C: "CA additions",
  D: "Total under CA law",
  E: "California source",
};

export default async function StatePage() {
  const { packet, index } = getPacket();
  const { ledger } = await getLedger();
  const version = index.latestVersion;
  const lines = index.lines.get(version)!;
  const run = runChecks(packet, index);
  const related = run.findings.filter((f) => f.area === "state");
  const ctx = makeContext(packet, index, version);
  const params = packet.engine_reference.parameters as Record<string, unknown>;
  const caDays = residentDays(ctx, "CA");
  const yearDays = typeof params.year_days === "number" ? params.year_days : 365;

  // Schedule CA rows: SchCA540NR.<row>.<col>
  const rows = new Map<string, Partial<Record<(typeof COLS)[number], ReturnLine>>>();
  for (const l of lines.values()) {
    const m = /^SchCA540NR\.([^.]+)\.([ABCDE])$/.exec(l.key);
    if (!m) continue;
    const r = rows.get(m[1]) ?? {};
    r[m[2] as (typeof COLS)[number]] = l;
    rows.set(m[1], r);
  }
  const ordered = [...rows.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  const labelOf = (r: Partial<Record<string, ReturnLine>>) => (r.A ?? r.D ?? r.E)?.label.replace(/ - (federal|total using CA law|California amount|CA additions|CA subtractions).*$/i, "") ?? "";
  const f540 = [...lines.values()].filter((l) => l.form === "F540NR").sort((a, b) => Number(a.line) - Number(b.line));
  const findingKeys = new Set(related.flatMap((f) => f.refs));
  const caSummary = index.versions.get(version)!.summary.california;

  return (
    <>
      <PageHeader
        title="California split"
        description={
          "Part-year resident: California from " +
          fmtDate(packet.household.residency[0].from) +
          " to " +
          fmtDate(packet.household.residency[0].to) +
          ", then Texas. Schedule CA (540NR) splits every income line into what California may tax, and Form 540NR prorates the tax."
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="California resident days" value={caDays} hint={fmtPct(caDays / yearDays) + " of the year · engine uses " + String(params.ca_resident_days)} tone={caDays === params.ca_resident_days ? undefined : "danger"} />
        <Stat label="Total AGI under CA law" value={fmtMoney(caSummary.total_agi)} />
        <Stat label="California-source AGI" value={fmtMoney(caSummary.ca_agi)} hint={fmtPct(caSummary.ca_agi / caSummary.total_agi) + " of total"} />
        <Stat label="California tax" value={fmtMoney(caSummary.total_tax)} hint={caSummary.balance_due < 0 ? "refund " + fmtMoney(-caSummary.balance_due) : "balance " + fmtMoney(caSummary.balance_due)} />
      </div>

      <div className="mt-4 grid gap-4">
        <Card title="Schedule CA (540NR)" description="Column E is what California taxes. Rows prorated by resident days are recomputed by the checks; the wage row is not prorated and is flagged." flush>
          <div className="overflow-auto">
            <table className="tbl dense">
              <thead>
                <tr>
                  <th>Line</th>
                  {COLS.map((c) => (
                    <th key={c} className="num">
                      {c} · {COL_LABELS[c]}
                    </th>
                  ))}
                  <th>Basis for E</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map(([row, r]) => (
                  <tr key={row} className={r.E && findingKeys.has(r.E.key) ? "is-active" : ""}>
                    <td>
                      <div className="font-medium">{labelOf(r)}</div>
                      <div className="font-mono text-[11px] text-muted">line {row}</div>
                    </td>
                    {COLS.map((c) => {
                      const l = r[c];
                      return (
                        <td key={c} className="num">
                          {l ? (
                            <RefLink refId={l.key} href={lineHref(l.key, version)} className={c === "E" ? "font-medium text-foreground" : "text-foreground"}>
                              {fmtLineValue(l.value)}
                            </RefLink>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="max-w-xs">
                      {r.E ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[11px] text-muted" title={packet.engine_reference.rules[r.E.rule]}>
                            {r.E.rule}
                          </span>
                          {findingKeys.has(r.E.key) ? (
                            <Badge tone="danger" dot>
                              finding
                            </Badge>
                          ) : /SOURCE$/.test(r.E.rule) ? (
                            <Badge tone="ok" dot>
                              recomputed
                            </Badge>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid content-start gap-4 xl:grid-cols-2">
          <Card title="Residency">
            <KV
              rows={[
                ...packet.household.residency.map((r) => [r.state, fmtDate(r.from) + " to " + fmtDate(r.to) + " · " + r.status] as [string, string]),
                ["Addresses", packet.household.addresses.map((a) => a.address).join(" → ")],
                ["Day ratio", caDays + " / " + yearDays + " = " + (caDays / yearDays).toFixed(4)],
              ]}
            />
          </Card>
          <Card title="Form 540NR computation" flush>
            <table className="tbl dense">
              <tbody>
                {f540.map((l) => (
                  <tr key={l.key}>
                    <td className="w-10 font-mono text-[11px] text-muted">{l.line}</td>
                    <td>
                      <RefLink refId={l.key} href={lineHref(l.key, version)} plain className="text-foreground">
                        {l.label}
                      </RefLink>
                    </td>
                    <td className="num">{typeof l.value === "number" && l.value < 1 && l.value > 0 ? l.value.toFixed(4) : fmtLineValue(l.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      <Card className="mt-4" title="California checks" description="Resident-day ratio, day-prorated lines and the wage split." flush>
        {related.length ? (
          <ul className="divide-y divide-border">
            {related.map((f) => (
              <FindingRow key={f.id} f={f} summary={ledger.summary("check:" + f.id)} />
            ))}
          </ul>
        ) : (
          <p className="p-4 text-[13px] text-muted">Every California check is clean.</p>
        )}
      </Card>
    </>
  );
}
