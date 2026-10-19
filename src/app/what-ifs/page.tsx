import { ArrowRight, FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, cn, Empty } from "@/components/ui";
import { AdoptButton } from "@/components/what-ifs/adopt-button";
import { activeAdjustments } from "@/lib/effective";
import { factsContext } from "@/lib/facts/context";
import { getLedger } from "@/lib/facts/repo";
import { fmtBalance, fmtDate, fmtLineValue, fmtMoney } from "@/lib/format";
import { getPacket } from "@/lib/packet/load";
import { canAdjust } from "@/lib/permissions";
import { lineHref } from "@/lib/refs";
import { staffOnlyPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "What-ifs" };

const signed = (n: number) => (n === 0 ? "no change" : (n > 0 ? "+" : "−") + fmtMoney(Math.abs(n)));

function Delta({ n, className }: { n: number | undefined; className?: string }) {
  if (n === undefined) return null;
  return <span className={cn("rounded-md px-1.5 font-mono text-[11px] leading-[18px] tabular-nums", n < 0 ? "bg-ok-soft text-ok" : n > 0 ? "bg-warn-soft text-warn" : "bg-surface-2 text-muted", className)}>{signed(n)}</span>;
}

function Jurisdiction({ label, base, alt, taxChange, penaltyChange }: { label: string; base?: Record<string, number>; alt?: Record<string, number>; taxChange?: number; penaltyChange?: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</span>
        <Delta n={taxChange} />
      </div>
      <dl className="mt-2 grid gap-1.5 text-[12.5px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">Total tax</dt>
          <dd className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-muted">{base?.total_tax !== undefined ? fmtMoney(base.total_tax) : "—"}</span>
            <ArrowRight className="h-3 w-3 self-center text-border-strong" />
            <span className="font-semibold">{alt?.total_tax !== undefined ? fmtMoney(alt.total_tax) : "—"}</span>
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">Balance</dt>
          <dd className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-muted">{base?.balance_due !== undefined ? fmtBalance(base.balance_due) : "—"}</span>
            <ArrowRight className="h-3 w-3 self-center text-border-strong" />
            <span className="font-semibold">{alt?.balance_due !== undefined ? fmtBalance(alt.balance_due) : "—"}</span>
          </dd>
        </div>
        {penaltyChange !== undefined ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">Penalty</dt>
            <dd>
              <Delta n={penaltyChange} />
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export default async function WhatIfsPage() {
  await staffOnlyPage();
  const { packet, index } = getPacket();
  const [{ ledger }, ctx] = await Promise.all([getLedger(), factsContext()]);
  const adjustments = activeAdjustments(ledger);
  const ext = packet.what_if.extension as { computed_at?: string; based_on_version?: string; federal?: Record<string, unknown>; california?: Record<string, unknown> };
  const adoptedCount = packet.what_if.alternatives.filter((alt) => adjustments.some((a) => a.whatIf === alt.id)).length;
  const EXT_LABELS: Record<string, string> = {
    estimated_total_tax: "Estimated total tax",
    payments: "Payments made",
    estimated_balance: "Estimated balance",
    paid_with_form_4868: "Paid with Form 4868",
    paid_with_ftb_3519: "Paid with FTB 3519",
    rule: "Rounding rule",
  };

  return (
    <>
      <PageHeader
        eyebrow="Review"
        title="What-ifs"
        description="Alternatives the engine computed in full. Adopting one records every changed line as an adjustment in a single batch, so the working return reflects it and one click undoes it. The engine's figures are exact; our rate-based estimates are shown alongside for comparison."
        meta={
          <>
            <Badge tone="neutral">{packet.what_if.alternatives.length} alternatives</Badge>
            <Badge tone={adoptedCount ? "accent" : "neutral"} dot>
              {adoptedCount ? adoptedCount + " adopted" : "none adopted"}
            </Badge>
          </>
        }
      />
      <div className="grid gap-4">
        {packet.what_if.alternatives.map((alt) => {
          const fed = alt.federal as { base?: Record<string, number>; alternative?: Record<string, number>; total_tax_change?: number; penalty_change?: number };
          const ca = alt.california as { base?: Record<string, number>; alternative?: Record<string, number>; total_tax_change?: number };
          const adopted = adjustments.find((a) => a.whatIf === alt.id);
          const changed = alt.changed_lines.filter((c) => typeof c.new === "number" || typeof c.old === "number");
          const totalChange = (fed.total_tax_change ?? 0) + (ca.total_tax_change ?? 0);
          const choices = Object.entries(alt.choices as Record<string, unknown>);
          return (
            <Card
              key={alt.id}
              id={alt.id}
              className={cn(adopted && "ring-1 ring-inset ring-accent/30")}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent ring-1 ring-inset ring-accent/25">
                    <FlaskConical className="h-3.5 w-3.5" />
                  </span>
                  {alt.description}
                  {adopted ? (
                    <Badge tone="accent" dot>
                      adopted
                    </Badge>
                  ) : null}
                </span>
              }
              description={
                <span className="flex flex-wrap items-center gap-1.5">
                  <span>Based on {alt.base_version}</span>
                  <span className="font-mono text-[11px]">{alt.id}</span>
                  {choices.map(([k, v]) => (
                    <span key={k} className="rounded-md bg-surface-2 px-1.5 font-mono text-[10.5px] leading-[18px] text-muted">
                      {k}: {String(v)}
                    </span>
                  ))}
                </span>
              }
              aside={
                <span className="flex items-center gap-3">
                  <span className="flex items-baseline gap-1.5">
                    <span className={cn("text-[20px] font-semibold leading-none tabular-nums tracking-[-0.02em]", totalChange < 0 ? "text-ok" : totalChange > 0 ? "text-warn" : "")}>{signed(totalChange)}</span>
                    <span className="text-[11px] uppercase tracking-[0.05em] text-muted">total tax</span>
                  </span>
                  <AdoptButton id={alt.id} adoptedBatch={adopted?.batchId ?? null} allowed={canAdjust(ctx.actor)} />
                </span>
              }
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="grid content-start gap-3">
                  <Jurisdiction label="Federal" base={fed.base} alt={fed.alternative} taxChange={fed.total_tax_change} penaltyChange={fed.penalty_change} />
                  <Jurisdiction label="California" base={ca.base} alt={ca.alternative} taxChange={ca.total_tax_change} />
                  <p className="text-[11.5px] leading-4 text-muted">{changed.length} lines move. Adopting writes them as one batch of adjustments against {alt.base_version}.</p>
                </div>
                <div className="lg:col-span-2">
                  {changed.length === 0 ? (
                    <Empty>No return line moves under this alternative; it changes how the penalty is computed, not the lines. Adopt it to record the election.</Empty>
                  ) : null}
                  <table className={cn("tbl dense", changed.length === 0 && "hidden")}>
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
                              <span className="flex flex-wrap items-center gap-1.5">
                                <RefLink refId={c.key} href={lineHref(c.key, alt.base_version)} />
                                <span className="truncate text-muted">{index.lines.get(alt.base_version)?.get(c.key)?.label}</span>
                              </span>
                            </td>
                            <td className="num text-muted">{c.old === undefined ? "—" : fmtLineValue(c.old as number | string)}</td>
                            <td className="num font-semibold">{c.new === undefined ? "—" : fmtLineValue(c.new as number | string)}</td>
                            <td className={cn("num font-medium", d ? (d > 0 ? "text-warn" : "text-ok") : "text-muted")}>{d ? (d > 0 ? "+" : "") + fmtLineValue(d) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {changed.length > 12 ? (
                    <div className="border-t border-border px-3 py-2 text-[12px] text-muted">
                      and {changed.length - 12} more lines
                      {adopted ? (
                        <>
                          {" · "}
                          <Link href={"/compare?a=" + alt.base_version + "&b=working"} className="text-accent hover:underline">
                            see them all on Compare
                          </Link>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}

        <Card title="April extension estimate" description={"How the extension payments were sized" + (ext.based_on_version ? ", from " + ext.based_on_version : "") + (ext.computed_at ? " on " + fmtDate(ext.computed_at) : "") + ". An extension of time to file is not an extension of time to pay."}>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["Federal (Form 4868)", ext.federal],
                ["California (FTB 3519)", ext.california],
              ] as const
            ).map(([label, data]) => (
              <div key={label} className="rounded-lg border border-border bg-surface-2/40 p-3">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</div>
                <dl className="mt-2 grid gap-1.5 text-[12.5px]">
                  {Object.entries(data ?? {}).map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted">{EXT_LABELS[k] ?? k.replace(/_/g, " ")}</dt>
                      <dd className={cn("text-right tabular-nums", k.startsWith("paid_with") && "font-semibold")}>{typeof v === "number" ? (k === "estimated_balance" ? fmtBalance(v) : fmtMoney(v)) : String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
