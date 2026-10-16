import type { Metadata } from "next";
import Link from "next/link";
import { JudgmentForm, type RecordedJudgment } from "@/components/judgment/judgment-form";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, cn, SectionTitle, Stat } from "@/components/ui";
import { decisionPoints, dueDiligenceItems, varianceItems } from "@/lib/completeness";
import { effectiveReturn } from "@/lib/effective";
import { factsContext } from "@/lib/facts/context";
import { getLedger } from "@/lib/facts/repo";
import type { FactView } from "@/lib/facts/types";
import { formShort } from "@/lib/forms";
import { fmtLineValue, fmtMoney, fmtPct } from "@/lib/format";
import { getPacket } from "@/lib/packet/load";
import { canVerify } from "@/lib/permissions";
import { lineHref } from "@/lib/refs";

export const metadata: Metadata = { title: "Judgment" };

export function recorded(f: FactView | null): RecordedJudgment | null {
  if (!f) return null;
  return {
    actorName: f.actorName,
    at: f.at,
    text: String(f.body.text ?? ""),
    authority: typeof f.body.authority === "string" ? f.body.authority : undefined,
    choice: typeof f.body.choice === "string" ? f.body.choice : undefined,
    status: typeof f.body.status === "string" ? f.body.status : undefined,
    answers: Array.isArray(f.body.answers) ? (f.body.answers as boolean[]) : undefined,
  };
}

const signed = (n: number | null) => (n === null ? "—" : n === 0 ? "no change" : (n > 0 ? "+" : "−") + fmtMoney(Math.abs(n)));

export default async function JudgmentPage() {
  const { packet, index } = getPacket();
  const [{ ledger }, ctx] = await Promise.all([getLedger(), factsContext()]);
  const allowed = canVerify(ctx.actor);
  const eff = effectiveReturn(packet, index, ledger);
  const variances = varianceItems(packet, index, ledger, eff);
  const decisions = decisionPoints(packet, index, ledger);
  const dd = dueDiligenceItems(packet, index, ledger);
  const elections = decisions.filter((d) => d.kind === "election" || d.kind === "judgment_call");
  const penalties = decisions.filter((d) => d.kind === "penalty");
  const diagnostics = decisions.filter((d) => d.kind === "diagnostic");
  const rule = packet.firm.starter_standards.variance_review;
  const explained = variances.filter((v) => v.explanation).length;
  const ddApplicable = dd.filter((d) => d.applicable);

  return (
    <>
      <PageHeader
        title="Judgment"
        description="Where a person, not the engine, decided something: swings from last year with their explanation, elections and judgment calls with the authority relied on, due diligence for the credits claimed, and penalty decisions. Each record is a fact in the ledger."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Swings vs 2024" value={explained + " / " + variances.length} hint={"explained · over " + rule.flag_if_change_over_percent + "% and " + fmtMoney(rule.and_over_amount)} tone={explained === variances.length ? "ok" : "warn"} />
        <Stat label="Elections and judgment calls" value={elections.filter((d) => d.recorded).length + " / " + elections.length} hint="recorded with authority" tone={elections.every((d) => d.recorded) ? "ok" : undefined} />
        <Stat label="Due diligence" value={ddApplicable.filter((d) => d.recorded).length + " / " + ddApplicable.length} hint="credits documented" tone={ddApplicable.every((d) => d.recorded) ? "ok" : "warn"} />
        <Stat label="Engine diagnostics" value={diagnostics.filter((d) => d.recorded).length + " / " + diagnostics.length} hint="addressed" />
      </div>

      <section id="variances" className="mt-6 scroll-mt-20">
        <SectionTitle>Swings against 2024</SectionTitle>
        <Card description={"Lines that moved more than " + rule.flag_if_change_over_percent + "% and " + fmtMoney(rule.and_over_amount) + " since the 2024 return as filed. A one-line reason turns a flag into evidence."} flush>
          <div className="overflow-auto">
            <table className="tbl dense">
              <thead>
                <tr>
                  <th>Line</th>
                  <th className="num">2024</th>
                  <th className="num">{eff.version}</th>
                  <th className="num">Change</th>
                  <th>Explanation</th>
                </tr>
              </thead>
              <tbody>
                {variances.map((v) => (
                  <tr key={v.key} className={cn(!v.explanation && "bg-warn-soft/30")}>
                    <td className="max-w-xs">
                      <div className="flex items-baseline gap-2">
                        <RefLink refId={v.key} href={lineHref(v.key)} />
                        <span className="text-muted">{formShort(v.form)}</span>
                      </div>
                      <div className="truncate">{v.label}</div>
                    </td>
                    <td className="num text-muted">{fmtLineValue(v.prior)}</td>
                    <td className="num font-medium">
                      {fmtLineValue(v.now)}
                      {v.working !== null && v.working !== v.now ? <div className="text-[11px] text-accent">working {fmtLineValue(v.working)}</div> : null}
                    </td>
                    <td className="num">
                      <span className={v.diff > 0 ? "text-warn" : "text-ok"}>{(v.diff > 0 ? "+" : "") + fmtLineValue(v.diff)}</span>
                      {v.pct !== null ? <span className="ml-1 text-[11px] text-muted">{fmtPct(v.pct)}</span> : null}
                    </td>
                    <td className="min-w-[320px]">
                      <JudgmentForm target={v.key} type="variance" recorded={recorded(v.explanation)} allowed={allowed} compact buttonLabel="Explain" placeholder="Why this line moved: new job, sale, move, one-off event…" />
                    </td>
                  </tr>
                ))}
                {variances.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted">
                      No swings over the firm threshold.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section id="decisions" className="mt-6 scroll-mt-20">
        <SectionTitle>Elections and judgment calls</SectionTitle>
        <div className="grid gap-4">
          {elections.map((d) => (
            <Card
              key={d.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {d.title}
                  <Badge tone={d.kind === "election" ? "accent" : "neutral"}>{d.kind.replace("_", " ")}</Badge>
                  {d.recorded ? (
                    <Badge tone="ok" dot>
                      recorded
                    </Badge>
                  ) : (
                    <Badge tone="warn" dot>
                      open
                    </Badge>
                  )}
                </span>
              }
              description={d.context}
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  {d.options.length ? (
                    <table className="tbl dense">
                      <thead>
                        <tr>
                          <th>Option</th>
                          <th className="num">Total tax change</th>
                          <th>State</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.options.map((o) => (
                          <tr key={o.id} className={cn(d.current === o.id && "is-active")}>
                            <td>{o.label}</td>
                            <td className={cn("num", o.taxChange && o.taxChange < 0 ? "text-ok" : o.taxChange ? "text-warn" : "text-muted")}>{signed(o.taxChange)}</td>
                            <td>
                              {d.current === o.id ? <Badge tone="accent">in force</Badge> : null}
                              {o.whatIfId && d.adoptedWhatIf === o.whatIfId ? <Badge tone="ok">adopted</Badge> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                    {d.refs.map((r) => (
                      <RefLink key={r} refId={r} />
                    ))}
                    {d.options.length > 1 ? (
                      <Link href="/what-ifs" className="text-[12px] text-accent hover:underline">
                        compare and adopt on What-ifs
                      </Link>
                    ) : null}
                  </div>
                </div>
                <JudgmentForm
                  target={d.target}
                  type={d.kind === "election" ? "election" : "judgment_call"}
                  recorded={recorded(d.recorded)}
                  options={d.options.length ? d.options.map((o) => ({ id: o.id, label: o.label })) : undefined}
                  requireAuthority
                  allowed={allowed}
                  placeholder="The facts considered and why this option is right for the client"
                />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section id="due-diligence" className="mt-6 scroll-mt-20">
        <SectionTitle>Due diligence</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          {dd.map((item) => (
            <Card
              key={item.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {item.credit}
                  {item.applicable ? (
                    item.recorded ? (
                      <Badge tone="ok" dot>
                        documented
                      </Badge>
                    ) : (
                      <Badge tone="warn" dot>
                        required
                      </Badge>
                    )
                  ) : (
                    <Badge tone="neutral">not required</Badge>
                  )}
                </span>
              }
              description={item.why}
            >
              <div className="mb-2 flex flex-wrap gap-x-3 gap-y-0.5">
                {item.refs.map((r) => (
                  <RefLink key={r} refId={r} />
                ))}
              </div>
              {item.applicable ? (
                <JudgmentForm target={item.target} type="due_diligence" recorded={recorded(item.recorded)} questions={item.questions} allowed={allowed} buttonLabel="Complete the checklist" placeholder="Records reviewed and questions asked, in your own words" />
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      <section id="penalties" className="mt-6 scroll-mt-20">
        <SectionTitle>Penalty decisions</SectionTitle>
        <div className="grid gap-4">
          {penalties.map((d) => (
            <Card key={d.id} title={d.title} description={d.context}>
              <div className="grid gap-4 lg:grid-cols-2">
                <table className="tbl dense">
                  <tbody>
                    {d.options.map((o) => (
                      <tr key={o.id} className={cn(d.current === o.id && "is-active")}>
                        <td>{o.label}</td>
                        <td className="num">{o.penaltyChange !== null && o.penaltyChange !== undefined ? "penalty " + signed(o.penaltyChange) : signed(o.taxChange)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <JudgmentForm target={d.target} type="penalty" recorded={recorded(d.recorded)} options={d.options.map((o) => ({ id: o.id, label: o.label }))} allowed={allowed} placeholder="Method chosen and whether a waiver or exception applies" />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section id="diagnostics" className="mt-6 scroll-mt-20">
        <SectionTitle>Engine diagnostics to address</SectionTitle>
        <Card flush>
          <ul className="divide-y divide-border">
            {diagnostics.map((d) => (
              <li key={d.id} className="grid gap-2 px-4 py-3 lg:grid-cols-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="font-mono text-[11px] text-muted">{d.id}</span>
                    {d.recorded ? (
                      <Badge tone="ok" dot>
                        addressed
                      </Badge>
                    ) : (
                      <Badge tone="warn" dot>
                        open
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[13px]">{d.context}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3">
                    {d.refs.map((r) => (
                      <RefLink key={r} refId={r} />
                    ))}
                  </div>
                </div>
                <JudgmentForm target={d.target} type="diagnostic" recorded={recorded(d.recorded)} allowed={allowed} compact buttonLabel="Address" placeholder="What was done about it, or why it needs nothing" />
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </>
  );
}
