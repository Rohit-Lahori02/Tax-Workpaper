import { ArrowRight, CalendarRange, MoveRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/filing/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, cn, Empty, KV, Stat } from "@/components/ui";
import { rollforwardAction } from "@/lib/facts/actions-filing";
import { fmtDate, fmtDateTime, fmtMoney, fmtPct } from "@/lib/format";
import { canRollForward, canSeeLedger } from "@/lib/permissions";
import { hrefFor, lineHref } from "@/lib/refs";
import { getReviewContext } from "@/lib/review";
import { basisGaps, carryforwardRows, estimatePlan, PHASE_LABELS } from "@/lib/season";
import { getCurrentActor } from "@/lib/session";

export const metadata: Metadata = { title: "Next year" };

export default async function NextYearPage() {
  const actor = await getCurrentActor();
  if (!canSeeLedger(actor)) notFound();
  const ctx = await getReviewContext();
  const { packet, index, ledger, eff, filing } = ctx;
  const year = packet.household.tax_year;
  const rows = carryforwardRows(packet, index);
  const gaps = basisGaps(packet, ledger);
  const plan = estimatePlan(packet, eff);
  const rolled = ledger.latest("year:" + (year + 1), "filing");
  const nonzero = rows.filter((r) => typeof r.value === "number" && r.value !== 0);
  const into = packet.prior_years.carryovers_into_2025 as Record<string, unknown>;
  const openPrior = packet.prior_years.prior_preparer_workpaper.open_items_left_by_prior_preparer;

  return (
    <>
      <PageHeader
        eyebrow="Filing"
        title={"Carry forward to " + (year + 1)}
        description="What the next preparer opens this file to find: every amount that carries, where it came from this year and where it lands next year; the basis questions still open; and the estimates that keep the household inside the safe harbor."
        meta={
          <>
            <Badge tone={filing.asFiled ? "ok" : "warn"} dot>
              {PHASE_LABELS[filing.phase]}
            </Badge>
            {rolled ? (
              <Badge tone="ok" dot>
                rolled forward {fmtDateTime(rolled.at)} by {rolled.actorName}
              </Badge>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Amounts carrying" value={nonzero.length} hint={rows.length + " tracked"} />
        <Stat label="Open basis items" value={gaps.length} tone={gaps.length ? "warn" : "ok"} />
        <Stat label={year + 1 + " federal safe harbor"} value={fmtMoney(plan.federal.safeHarbor)} hint={"110% of " + fmtMoney(plan.federal.basis)} />
        <Stat label={year + 1 + " California safe harbor"} value={fmtMoney(plan.california.safeHarbor)} hint={"110% of " + fmtMoney(plan.california.basis)} />
      </div>

      <Card className="mt-4" title="Carryovers" description="From the engine's carryovers_out on the current version, with each year's opening figure beside it where the same item came in." flush>
        <table className="tbl">
          <thead>
            <tr>
              <th>Item</th>
              <th>Jurisdiction</th>
              <th className="text-right">Came in with</th>
              <th className="text-right">Goes out with</th>
              <th>From this year</th>
              <th>To next year</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={typeof r.value === "number" && r.value === 0 && r.openedWith === null ? "text-muted" : ""}>
                {/* zero-with-nothing-in rows stay muted so the eye lands on amounts that move */}
                <td>
                  {r.label}
                  {r.note ? <div className="text-[11.5px] text-muted">{r.note}</div> : null}
                </td>
                <td>
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] capitalize", r.jurisdiction === "federal" ? "bg-accent-soft text-accent" : "bg-warn-soft text-warn")}>{r.jurisdiction}</span>
                </td>
                <td className="text-right tabular-nums text-muted">{r.openedWith !== null ? fmtMoney(r.openedWith) : <span className="text-border-strong">—</span>}</td>
                <td className="text-right tabular-nums font-medium">{typeof r.value === "number" ? fmtMoney(r.value) : String(r.value)}</td>
                <td>
                  {r.from.length ? (
                    r.from.map((k) => (
                      <Link key={k} href={k.startsWith("asset:") ? hrefFor(k) : lineHref(k)} className="ref mr-1">
                        {k}
                      </Link>
                    ))
                  ) : (
                    <span className="text-muted">engine</span>
                  )}
                </td>
                <td className="text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <MoveRight className="h-3 w-3 text-border-strong" />
                    {r.to}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Basis records still open" description="The prior preparer left these unestablished. They follow the file until someone closes them with a record.">
          {gaps.length ? (
            <ul className="grid gap-2 text-[13px]">
              {gaps.map((g) => (
                <li key={g.id} className="flex items-start gap-2">
                  <Badge tone="warn" className="mt-0.5 shrink-0">
                    open
                  </Badge>
                  <div>
                    <div className="font-medium">{g.label}</div>
                    <div className="text-[12px] text-muted">{g.detail}</div>
                    <Link href={"/r/" + encodeURIComponent(g.target)} className="text-[12px] text-accent hover:underline">
                      record a note or judgment
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Every basis record has a figure or a decision.</Empty>
          )}
          {openPrior.length ? (
            <div className="mt-4 border-t border-border pt-3">
              <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Open items the prior preparer listed</h4>
              <ul className="grid gap-1 text-[12.5px] text-muted">
                {openPrior.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <KV className="mt-4" rows={[["Opening carryovers came from", String(into.sources ?? "")]]} />
        </Card>

        <Card title={year + 1 + " estimated payments"} description="Safe harbor: the lesser of 90% of next year's tax or 110% of this year's. Next year's tax is unknown, so the plan uses 110% of this year's working total tax.">
          <div className="grid gap-4 sm:grid-cols-2">
            {(["federal", "california"] as const).map((j) => (
              <div key={j}>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">{j}</h4>
                <table className="tbl text-[12.5px]">
                  <tbody>
                    {plan[j].rows.map((r) => (
                      <tr key={r.due}>
                        <td className="tabular-nums">{fmtDate(r.due)}</td>
                        <td className="text-muted">{fmtPct(r.share)}</td>
                        <td className="text-right tabular-nums font-medium">{fmtMoney(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1.5 text-[11.5px] leading-4 text-muted">{plan[j].rule}</p>
              </div>
            ))}
          </div>
          <h4 className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Known changes for {year + 1}</h4>
          <ul className="grid gap-1 text-[12.5px]">
            {plan.changes.map((c) => (
              <li key={c} className="flex items-start gap-2">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                {c}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4" title={"Roll the file forward to " + (year + 1)} description="Writes one record with the carryovers and the open items as they stand, fingerprinted. The next engagement opens from that record; if this year's return is later amended, the fingerprint no longer matches and the roll-forward shows as stale.">
        {rolled ? (
          <KV
            rows={[
              ["Rolled forward", fmtDateTime(rolled.at) + " by " + rolled.actorName],
              ["Items carried", String(Object.keys((rolled.body.carryovers as Record<string, unknown>) ?? {}).length)],
              ["Open items carried", ((rolled.body.openItems as string[]) ?? []).join("; ") || "none"],
              ["Fingerprint", <span key="h" className="font-mono text-[11px]">{String(rolled.body.hash).slice(0, 16)}</span>],
            ]}
          />
        ) : null}
        <div className="mt-3">
          <ActionForm
            action={rollforwardAction}
            label={rolled ? "Roll forward again" : "Roll forward to " + (year + 1)}
            icon={<CalendarRange className="h-3.5 w-3.5" />}
            primary={!rolled}
            disabled={!canRollForward(actor) || !filing.asFiled}
            disabledReason={!canRollForward(actor) ? "Preparer-and-above rolls the file forward." : "Available once the return is accepted; carryovers are not final before then."}
            fields={[{ name: "text", label: "Hand-off note for the next preparer", type: "textarea", placeholder: "Household is a Texas resident all of next year; only the Sacramento rental and Ridgeline's California share are California-source." }]}
          />
        </div>
      </Card>
    </>
  );
}
