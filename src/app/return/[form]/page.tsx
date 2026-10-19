import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Marks } from "@/components/facts/fact-marks";
import { PageHeader } from "@/components/page-header";
import { FormNav, formsInVersion } from "@/components/return/form-nav";
import { BulkBar, RowCheckbox, SelectAllCheckbox, SelectionProvider } from "@/components/return/selection";
import { VersionSwitch } from "@/components/return/version-switch";
import { Badge, Card, cn } from "@/components/ui";
import { effectiveReturn } from "@/lib/effective";
import { factsContext } from "@/lib/facts/context";
import { getLedger } from "@/lib/facts/repo";
import { formLabel, formShort } from "@/lib/forms";
import { fmtLineValue, fmtMoney, fmtPct } from "@/lib/format";
import { canVerify } from "@/lib/permissions";
import { lineHref } from "@/lib/refs";
import { getEffectivePacket } from "@/lib/standards-server";
import { variance } from "@/lib/variance";
import { staffOnlyPage } from "@/lib/page-guards";

type Props = { params: Promise<{ form: string }>; searchParams: Promise<{ v?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { form } = await params;
  return { title: formShort(decodeURIComponent(form)) };
}

export default async function FormPage({ params, searchParams }: Props) {
  await staffOnlyPage();
  const { form: rawForm } = await params;
  const { v } = await searchParams;
  const form = decodeURIComponent(rawForm);
  const { packet, index } = await getEffectivePacket();
  const working = v === "working";
  const version = !working && v && index.versions.has(v) ? v : index.latestVersion;
  const all = [...(index.lines.get(version)?.values() ?? [])];
  const lines = all.filter((l) => l.form === form);
  if (lines.length === 0) notFound();

  const [{ ledger }, ctx] = await Promise.all([getLedger(), factsContext()]);
  const eff = effectiveReturn(packet, index, ledger, version);
  const forms = formsInVersion(index, version);
  const jurisdiction = lines[0].jurisdiction;
  const rule = packet.firm.starter_standards.variance_review;
  const isFlagged = (key: string, value: number | string) => {
    const prior = index.priorYearLines.get(key);
    return Boolean(prior && typeof prior.value === "number" && typeof value === "number" && variance(value, prior.value, packet).flagged);
  };
  const withPrior = lines.filter((l) => index.priorYearLines.has(l.key)).length;
  const flagged = lines.filter((l) => isFlagged(l.key, l.value)).length;
  const verified = lines.filter((l) => ledger.summary(l.key).verifications.length > 0).length;
  const blocking = lines.filter((l) => ledger.summary(l.key).blockingOpen > 0).length;
  const changedHere = lines.filter((l) => eff.lines.get(l.key)?.kind && eff.lines.get(l.key)!.kind !== "blocked").length;
  const keys = lines.map((l) => l.key);
  const staff = ctx.actor.kind === "staff";
  const switchHref = (x: string) => "/return/" + encodeURIComponent(form) + "?v=" + x;
  const versionOptions = [...index.versionOrder, { id: "working", label: "Working" + (eff.adjustments.length ? " · " + eff.adjustments.length : ""), hint: "The current return with every adjustment applied" }];
  // Per-form attention for the side nav: swings and blocking notes.
  const attention: Record<string, number> = {};
  for (const l of all) {
    const n = (isFlagged(l.key, l.value) ? 1 : 0) + (ledger.summary(l.key).blockingOpen ? 1 : 0);
    if (n) attention[l.form] = (attention[l.form] ?? 0) + n;
  }
  const pct = lines.length ? Math.round((verified / lines.length) * 100) : 0;
  const cols = 8 + (staff ? 1 : 0) + (working ? 2 : 0);

  return (
    <SelectionProvider>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/return" className="hover:text-foreground">
              Return
            </Link>
            <span className="text-border-strong">/</span>
            <span className="capitalize">{jurisdiction}</span>
          </span>
        }
        title={formLabel(form)}
        description={
          lines.length +
          " lines in " +
          version +
          (working ? " with " + eff.adjustments.length + " adjustment" + (eff.adjustments.length === 1 ? "" : "s") + " applied" : "") +
          ". " +
          (withPrior ? withPrior + " have a 2024 counterpart; " + flagged + " moved more than " + rule.flag_if_change_over_percent + "% and " + fmtMoney(rule.and_over_amount) + "." : "No line on this form has a 2024 counterpart.")
        }
        meta={
          <>
            <Badge tone={verified === lines.length ? "ok" : "neutral"} dot>
              {verified} of {lines.length} verified
            </Badge>
            {flagged ? (
              <Badge tone="warn" dot>
                {flagged} swing{flagged === 1 ? "" : "s"} vs 2024
              </Badge>
            ) : null}
            {blocking ? (
              <Badge tone="danger" dot>
                {blocking} with blocking notes
              </Badge>
            ) : null}
            {changedHere ? (
              <Badge tone="accent" dot>
                {changedHere} line{changedHere === 1 ? "" : "s"} differ in the working return
              </Badge>
            ) : null}
          </>
        }
        actions={<VersionSwitch versions={versionOptions} current={working ? "working" : version} latest={index.latestVersion} href={switchHref} />}
      />

      <div className="grid gap-4 lg:grid-cols-[228px_minmax(0,1fr)]">
        <FormNav forms={forms} active={form} version={working ? "working" : version} attention={attention} />
        <Card flush>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px] font-medium">{formShort(form)}</span>
              <Badge className="capitalize">{jurisdiction}</Badge>
              <Badge tone="neutral" mono>
                {working ? "working" : version}
              </Badge>
            </div>
            <div className="ml-auto flex items-center gap-3 text-[12px] text-muted">
              <span>
                <span className="font-medium tabular-nums text-foreground">{pct}%</span> verified
              </span>
              <span className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-2">
                <span className={cn("block h-full rounded-full", pct === 100 ? "bg-ok" : "bg-accent")} style={{ width: pct + "%" }} />
              </span>
              {staff ? <span className="hidden text-[11.5px] sm:inline">Select rows to verify in bulk</span> : null}
            </div>
          </div>
          <div className="overflow-auto">
            <table className="tbl dense">
              <thead>
                <tr>
                  {staff ? (
                    <th className="w-9">
                      <SelectAllCheckbox keys={keys} />
                    </th>
                  ) : null}
                  <th className="w-14">Line</th>
                  <th>Label</th>
                  <th className="num">{version}</th>
                  {working ? <th className="num">Working</th> : null}
                  {working ? <th className="num">Δ</th> : null}
                  <th className="num">2024</th>
                  <th className="num">Change</th>
                  <th className="num">Sources</th>
                  <th>Rule</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const prior = index.priorYearLines.get(l.key);
                  const numeric = typeof l.value === "number" && prior && typeof prior.value === "number";
                  const vr = numeric ? variance(l.value as number, prior.value as number, packet) : null;
                  const inputs = l.inputs.length;
                  const s = ledger.summary(l.key);
                  const w = eff.lines.get(l.key);
                  const changed = working && w && w.kind !== "blocked";
                  const href = lineHref(l.key, version);
                  return (
                    <tr key={l.key} className={cn(changed && "is-active", s.blockingOpen && "bg-danger-soft/20")}>
                      {staff ? (
                        <td>
                          <RowCheckbox lineKey={l.key} />
                        </td>
                      ) : null}
                      <td className="whitespace-nowrap">
                        <Link href={href} className="font-mono text-[11.5px] text-muted hover:text-accent">
                          {l.line}
                        </Link>
                      </td>
                      <td className="min-w-[240px] max-w-xl">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Link href={href} className="font-medium text-foreground/90 hover:text-accent">
                            {l.label}
                          </Link>
                          {l.note ? <Info className="h-3.5 w-3.5 shrink-0 text-muted" aria-label={l.note} /> : null}
                          {w && working ? (
                            <Badge tone={w.kind === "adjusted" ? "accent" : w.kind === "derived" ? "neutral" : "warn"}>{w.kind === "blocked" ? "needs engine rerun" : w.kind}</Badge>
                          ) : null}
                        </span>
                        {l.note ? <span className="sr-only">{l.note}</span> : null}
                      </td>
                      <td className={cn("num", changed ? "text-muted line-through" : "font-medium")}>{fmtLineValue(l.value)}</td>
                      {working ? <td className="num font-semibold">{changed ? fmtLineValue(w!.working) : fmtLineValue(l.value)}</td> : null}
                      {working ? <td className={cn("num", w && w.delta ? (w.delta > 0 ? "text-warn" : "text-ok") : "text-muted")}>{changed && w!.delta ? (w!.delta > 0 ? "+" : "") + fmtLineValue(Math.round(w!.delta * 100) / 100) : "—"}</td> : null}
                      <td className="num text-muted">{prior ? fmtLineValue(prior.value) : "—"}</td>
                      <td className="num">
                        {vr ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={vr.flagged ? "font-medium text-foreground" : "text-muted"}>{(vr.diff > 0 ? "+" : "") + fmtLineValue(vr.diff)}</span>
                            {vr.pct !== null ? <span className={cn("rounded-md px-1 font-mono text-[10.5px] leading-4", vr.flagged ? "bg-warn-soft text-warn" : "bg-surface-2 text-muted")}>{fmtPct(vr.pct)}</span> : null}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="num text-muted">{l.sources.length ? l.sources.length : inputs ? <span title={inputs + " input lines"}>{inputs} in</span> : "—"}</td>
                      <td>
                        <span className="whitespace-nowrap rounded-md bg-surface-2 px-1.5 font-mono text-[10.5px] leading-[18px] text-muted" title={packet.engine_reference.rules[l.rule]}>
                          {l.rule}
                        </span>
                      </td>
                      <td>{s.total ? <Marks s={s} /> : <span className="text-border-strong">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={cols} className="border-t border-border px-5 py-2 text-[11.5px] text-muted">
                    {lines.length} lines · {verified} verified · {flagged} flagged vs 2024 · click a line to see how it is built and what it rests on
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>
      {staff ? <BulkBar verificationTypes={ctx.verificationTypes} canVerify={canVerify(ctx.actor)} /> : null}
    </SelectionProvider>
  );
}
