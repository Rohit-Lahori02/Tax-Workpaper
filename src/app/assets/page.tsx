import type { Metadata } from "next";
import { FindingRow } from "@/components/checks/finding-row";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, Stat } from "@/components/ui";
import { runChecks } from "@/lib/checks/run";
import { getLedger } from "@/lib/facts/repo";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format";
import { getPacket } from "@/lib/packet/load";
import type { VersionAsset } from "@/lib/packet/schema";

export const metadata: Metadata = { title: "Depreciation" };

function n(obj: Record<string, unknown> | undefined, key: string): number | null {
  const v = obj?.[key];
  return typeof v === "number" ? v : null;
}

export default async function AssetsPage() {
  const { packet, index } = getPacket();
  const { ledger } = await getLedger();
  const version = index.latestVersion;
  const assets = index.versions.get(version)!.assets;
  const run = runChecks(packet, index);
  const related = run.findings.filter((f) => f.area === "rentals");
  const year = packet.household.tax_year;

  const groups = new Map<string, VersionAsset[]>();
  for (const a of assets) groups.set(a.activity, [...(groups.get(a.activity) ?? []), a]);
  const total = (xs: VersionAsset[], j: "federal" | "california" | "amt", k: string) => xs.reduce((s, a) => s + (n(a[j] as Record<string, unknown>, k) ?? 0), 0);
  const fed = total(assets, "federal", "depreciation_2025");
  const ca = total(assets, "california", "depreciation_2025");
  const amt = total(assets, "amt", "depreciation_2025");

  return (
    <>
      <PageHeader
        title="Depreciation by asset"
        description={
          assets.length +
          " assets across " +
          groups.size +
          " activities. Federal, California and AMT for " +
          year +
          ", accumulated totals rolled forward from the prior preparer's schedule, and disposals with their recapture."
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={"Federal " + year} value={fmtMoney(fed)} />
        <Stat label={"California " + year} value={fmtMoney(ca)} delta={{ text: (ca - fed > 0 ? "+" : "−") + fmtMoney(Math.abs(ca - fed)) + " vs federal", tone: "neutral" }} />
        <Stat label={"AMT " + year} value={fmtMoney(amt)} delta={{ text: amt === fed ? "no AMT difference" : (amt - fed > 0 ? "+" : "−") + fmtMoney(Math.abs(amt - fed)) + " vs federal", tone: "neutral" }} />
        <Stat label="Disposed this year" value={assets.filter((a) => a.disposed).length} hint="assets sold with 1200 Barton Hills" />
      </div>

      <div className="mt-4 grid gap-4">
        {[...groups.entries()].map(([activity, list]) => (
          <Card
            key={activity}
            title={activity}
            aside={
              <span>
                federal {fmtNumber(total(list, "federal", "depreciation_2025"))} · CA {fmtNumber(total(list, "california", "depreciation_2025"))}
              </span>
            }
            flush
          >
            <div className="overflow-auto">
              <table className="tbl dense">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Placed in service</th>
                    <th>Method · life</th>
                    <th className="num">Cost</th>
                    <th className="num">Land</th>
                    <th className="num">Prior accum.</th>
                    <th className="num">Federal {year}</th>
                    <th className="num">California {year}</th>
                    <th className="num">AMT {year}</th>
                    <th className="num">Accum. end</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => {
                    const f = a.federal as Record<string, unknown>;
                    const c = a.california as Record<string, unknown>;
                    const m = (a.amt ?? {}) as Record<string, unknown>;
                    const prior = index.priorAssets.get(a.asset_id);
                    const disposition = (a as unknown as { disposition?: Record<string, unknown> }).disposition;
                    const findings = run.findings.filter((x) => x.refs.includes("asset:" + a.asset_id));
                    return (
                      <tr key={a.asset_id} id={a.asset_id}>
                        <td>
                          <div className="font-medium">{a.description}</div>
                          <div className="flex items-center gap-2 text-[11px]">
                            <RefLink refId={"asset:" + a.asset_id} href={"/r/" + encodeURIComponent("asset:" + a.asset_id)} />
                            {prior ? (
                              <details className="inline">
                                <summary className="cursor-pointer text-muted hover:text-foreground">prior years</summary>
                                <span className="ml-1 font-mono text-muted">
                                  {Object.entries(prior.federal)
                                    .map(([y, v]) => y + " " + fmtNumber(v))
                                    .join(" · ")}
                                </span>
                              </details>
                            ) : (
                              <span className="text-muted">new in {year}</span>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap text-muted">{fmtDate(a.placed_in_service)}</td>
                        <td className="max-w-[220px] text-muted">
                          {a.method} · {a.life_years} yr
                        </td>
                        <td className="num">{fmtNumber(a.cost)}</td>
                        <td className="num text-muted">{n(a as unknown as Record<string, unknown>, "land_value_not_depreciated") !== null ? fmtNumber(n(a as unknown as Record<string, unknown>, "land_value_not_depreciated")!) : "—"}</td>
                        <td className="num text-muted">{fmtNumber(n(f, "prior_accumulated") ?? 0)}</td>
                        <td className="num font-medium">{fmtNumber(n(f, "depreciation_2025") ?? 0)}</td>
                        <td className="num">{fmtNumber(n(c, "depreciation_2025") ?? 0)}</td>
                        <td className="num">{fmtNumber(n(m, "depreciation_2025") ?? 0)}</td>
                        <td className="num">{fmtNumber(n(f, "accumulated_end") ?? 0)}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {a.disposed ? <Badge tone="warn">sold {fmtDate(String(a.disposed))}</Badge> : null}
                            {disposition && typeof disposition.unrecaptured_1250_depreciation === "number" ? (
                              <Badge tone="neutral" title="Unrecaptured section 1250 depreciation">
                                1250: {fmtNumber(disposition.unrecaptured_1250_depreciation)}
                              </Badge>
                            ) : null}
                            {findings.length ? (
                              <Badge tone="danger" dot>
                                {findings.length} finding{findings.length === 1 ? "" : "s"}
                              </Badge>
                            ) : (
                              <Badge tone="ok" dot>
                                checks pass
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))}

        <Card title="Rental and depreciation checks" description="Roll-forwards, straight-line recomputation, Schedule E agreement and the Form 4797 depreciation allowed." flush>
          {related.length ? (
            <ul className="divide-y divide-border">
              {related.map((f) => (
                <FindingRow key={f.id} f={f} summary={ledger.summary("check:" + f.id)} />
              ))}
            </ul>
          ) : (
            <p className="p-4 text-[13px] text-muted">
              Every roll-forward agrees to the prior schedule, every straight-line amount recomputes from cost and life, and Schedule E depreciation matches the assets by property.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
