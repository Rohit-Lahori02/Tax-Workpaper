import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, cn, KV } from "@/components/ui";
import { AdoptButton } from "@/components/what-ifs/adopt-button";
import { activeAdjustments } from "@/lib/effective";
import { factsContext } from "@/lib/facts/context";
import { getLedger } from "@/lib/facts/repo";
import { fmtBalance, fmtLineValue, fmtMoney } from "@/lib/format";
import { getPacket } from "@/lib/packet/load";
import { canAdjust } from "@/lib/permissions";
import { lineHref } from "@/lib/refs";

export const metadata: Metadata = { title: "What-ifs" };

const signed = (n: number) => (n === 0 ? "no change" : (n > 0 ? "+" : "−") + fmtMoney(Math.abs(n)));

export default async function WhatIfsPage() {
  const { packet, index } = getPacket();
  const [{ ledger }, ctx] = await Promise.all([getLedger(), factsContext()]);
  const adjustments = activeAdjustments(ledger);
  const ext = packet.what_if.extension as { computed_at?: string; based_on_version?: string; federal?: Record<string, unknown>; california?: Record<string, unknown> };

  return (
    <>
      <PageHeader
        title="What-ifs"
        description="Alternatives the engine computed in full. Adopting one records every changed line as an adjustment in a single batch, so the working return reflects it and one click undoes it. The engine's figures are exact; our rate-based estimates are shown alongside for comparison."
      />
      <div className="grid gap-4">
        {packet.what_if.alternatives.map((alt) => {
          const fed = alt.federal as { base?: Record<string, number>; alternative?: Record<string, number>; total_tax_change?: number; penalty_change?: number };
          const ca = alt.california as { base?: Record<string, number>; alternative?: Record<string, number>; total_tax_change?: number };
          const adopted = adjustments.find((a) => a.whatIf === alt.id);
          const changed = alt.changed_lines.filter((c) => typeof c.new === "number" || typeof c.old === "number");
          const totalChange = (fed.total_tax_change ?? 0) + (ca.total_tax_change ?? 0);
          return (
            <Card
              key={alt.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {alt.description}
                  {adopted ? (
                    <Badge tone="accent" dot>
                      adopted
                    </Badge>
                  ) : null}
                  <Badge tone={totalChange < 0 ? "ok" : totalChange > 0 ? "warn" : "neutral"}>
                    {signed(totalChange)} total tax
                  </Badge>
                </span>
              }
              description={"Based on " + alt.base_version + " · " + alt.id + " · choices: " + JSON.stringify(alt.choices)}
              aside={<AdoptButton id={alt.id} adoptedBatch={adopted?.batchId ?? null} allowed={canAdjust(ctx.actor)} />}
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <KV
                  rows={[
                    ["Federal tax", (fed.base?.total_tax !== undefined ? fmtMoney(fed.base.total_tax) + " → " + fmtMoney(fed.alternative?.total_tax ?? 0) : "—") + " (" + signed(fed.total_tax_change ?? 0) + ")"],
                    ["Federal balance", fed.base?.balance_due !== undefined ? fmtBalance(fed.base.balance_due) + " → " + fmtBalance(fed.alternative?.balance_due ?? 0) : "—"],
                    ["Federal penalty", fed.penalty_change !== undefined ? signed(fed.penalty_change) : "—"],
                    ["California tax", (ca.base?.total_tax !== undefined ? fmtMoney(ca.base.total_tax) + " → " + fmtMoney(ca.alternative?.total_tax ?? 0) : "—") + " (" + signed(ca.total_tax_change ?? 0) + ")"],
                    ["California balance", ca.base?.balance_due !== undefined ? fmtBalance(ca.base.balance_due) + " → " + fmtBalance(ca.alternative?.balance_due ?? 0) : "—"],
                  ]}
                />
                <div className="lg:col-span-2">
                  <table className="tbl dense">
                    <thead>
                      <tr>
                        <th>Line</th>
                        <th className="num">{alt.base_version}</th>
                        <th className="num">Alternative</th>
                        <th className="num">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changed.slice(0, 12).map((c) => {
                        const d = typeof c.new === "number" && typeof c.old === "number" ? c.new - c.old : null;
                        return (
                          <tr key={c.key}>
                            <td>
                              <RefLink refId={c.key} href={lineHref(c.key, alt.base_version)} />
                              <span className="ml-2 text-muted">{index.lines.get(alt.base_version)?.get(c.key)?.label}</span>
                            </td>
                            <td className="num text-muted">{c.old === undefined ? "—" : fmtLineValue(c.old as number | string)}</td>
                            <td className="num font-medium">{c.new === undefined ? "—" : fmtLineValue(c.new as number | string)}</td>
                            <td className={cn("num", d ? (d > 0 ? "text-warn" : "text-ok") : "text-muted")}>{d ? (d > 0 ? "+" : "") + fmtLineValue(d) : "—"}</td>
                          </tr>
                        );
                      })}
                      {changed.length > 12 ? (
                        <tr>
                          <td colSpan={4} className="text-muted">
                            and {changed.length - 12} more lines
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          );
        })}

        <Card title="April extension estimate" description={"How the extension payments were sized" + (ext.based_on_version ? ", from " + ext.based_on_version : "") + (ext.computed_at ? " on " + ext.computed_at.slice(0, 10) : "") + "."}>
          <div className="grid gap-4 sm:grid-cols-2">
            <KV rows={Object.entries(ext.federal ?? {}).map(([k, v]) => [k.replace(/_/g, " "), typeof v === "number" ? fmtMoney(v) : String(v)] as [string, string])} />
            <KV rows={Object.entries(ext.california ?? {}).map(([k, v]) => [k.replace(/_/g, " "), typeof v === "number" ? fmtMoney(v) : String(v)] as [string, string])} />
          </div>
        </Card>
      </div>
    </>
  );
}
