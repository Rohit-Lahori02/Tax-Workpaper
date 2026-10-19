import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FindingRow, SeverityIcon } from "@/components/checks/finding-row";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, cn, Stat } from "@/components/ui";
import { runChecks } from "@/lib/checks/run";
import { AREA_LABELS, type Area, type Severity } from "@/lib/checks/types";
import { resolvedFindingIds } from "@/lib/completeness";
import { getLedger } from "@/lib/facts/repo";
import { fmtMoney } from "@/lib/format";
import { getEffectivePacket } from "@/lib/standards-server";
import { staffOnlyPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Checks" };

type Props = { searchParams: Promise<{ severity?: string; area?: string; open?: string }> };

export default async function ChecksPage({ searchParams }: Props) {
  await staffOnlyPage();
  const { severity, area, open } = await searchParams;
  const { packet, index } = await getEffectivePacket();
  const { ledger } = await getLedger();
  const run = runChecks(packet, index);

  const sev = (["error", "warning", "info"] as Severity[]).includes(severity as Severity) ? (severity as Severity) : null;
  const ar = area && area in AREA_LABELS ? (area as Area) : null;
  const onlyOpen = open === "1";
  const resolved = resolvedFindingIds(ledger);
  const isOpen = (f: { id: string }) => !resolved.has(f.id);
  const openErrors = run.findings.filter((f) => f.severity === "error" && isOpen(f)).length;
  const addressed = run.findings.filter((f) => !isOpen(f)).length;

  const errors = run.findings.filter((f) => f.severity === "error");
  const effect = errors.reduce(
    (a, f) => ({ federal: a.federal + (f.effect?.federal ?? 0), california: a.california + (f.effect?.california ?? 0) }),
    { federal: 0, california: 0 },
  );
  const areas = (Object.keys(AREA_LABELS) as Area[]).filter((a) => run.results.some((r) => r.area === a));
  const rank = (r: (typeof run.results)[number]) => (r.findings.some((f) => f.severity === "error") ? 0 : r.findings.some((f) => f.severity === "warning") ? 1 : r.findings.length ? 2 : 3);
  const visible = run.results
    .filter((r) => (!ar || r.area === ar) && (!sev || r.findings.some((f) => f.severity === sev)) && (!onlyOpen || r.findings.length === 0 || r.findings.some(isOpen)))
    .sort((a, b) => rank(a) - rank(b) || areas.indexOf(a.area) - areas.indexOf(b.area));
  const href = (s: Severity | null, a: Area | null, o: boolean = onlyOpen) => {
    const q = new URLSearchParams();
    if (s) q.set("severity", s);
    if (a) q.set("area", a);
    if (o) q.set("open", "1");
    const qs = q.toString();
    return "/checks" + (qs ? "?" + qs : "");
  };
  const signed = (n: number) => (n === 0 ? "0" : (n > 0 ? "+" : "−") + fmtMoney(Math.abs(n)));
  const count = (s: Severity | null) => (s ? run.findings.filter((f) => f.severity === s && (!ar || f.area === ar)).length : run.findings.filter((f) => !ar || f.area === ar).length);
  const cleanVisible = visible.filter((r) => r.findings.length === 0);
  const withFindings = visible.filter((r) => r.findings.length > 0);

  return (
    <>
      <PageHeader
        eyebrow="Review"
        title="Checks"
        description={
          "Independent recomputations over the packet. They trust neither the engine nor the extractor: every sum is re-added, every cited document re-read, every agency record compared. Run against " +
          run.version +
          "."
        }
        meta={
          <>
            <Badge tone="neutral">{run.counts.checks} checks</Badge>
            <Badge tone="ok" dot>
              {run.counts.clean} clean
            </Badge>
            <Badge tone="neutral">{run.findings.length} findings</Badge>
            {addressed ? (
              <Badge tone="ok" dot>
                {addressed} addressed
              </Badge>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Errors" value={run.counts.error} tone={openErrors ? "danger" : "ok"} hint={run.counts.error ? (openErrors === run.counts.error ? "numbers the evidence contradicts" : openErrors + " still open · " + (run.counts.error - openErrors) + " addressed") : "numbers the evidence contradicts"} />
        <Stat label="Warnings" value={run.counts.warning} tone={run.counts.warning ? "warn" : undefined} hint="needs a person's judgment" />
        <Stat label="Information" value={run.counts.info} hint="worth knowing, no change implied" />
        <Stat
          label="If every error is corrected"
          value={
            <span className="grid grid-cols-[auto_auto] items-baseline gap-x-3 gap-y-0.5 text-[19px]">
              <span className={effect.federal > 0 ? "text-warn" : effect.federal < 0 ? "text-ok" : ""}>{signed(effect.federal)}</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted">federal</span>
              <span className={effect.california > 0 ? "text-warn" : effect.california < 0 ? "text-ok" : ""}>{signed(effect.california)}</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted">California</span>
            </span>
          }
          hint="estimated tax change at the engine's per-dollar rates"
        />
      </div>

      <div className="card mt-5 flex flex-col gap-3 p-3 lg:flex-row lg:items-start">
        <div className="seg">
          {([null, "error", "warning", "info"] as (Severity | null)[]).map((s) => (
            <Link key={s ?? "all"} href={href(s, ar)} className={cn("seg-item", sev === s && "is-active")}>
              {s ? <SeverityIcon severity={s} className="h-4 w-4 rounded ring-0 [&>svg]:h-3 [&>svg]:w-3" /> : null}
              {s ? s[0].toUpperCase() + s.slice(1) + "s" : "All"}
              <span className="font-mono text-[10.5px] text-muted">{count(s)}</span>
            </Link>
          ))}
        </div>
        <span className="mt-1.5 hidden h-5 w-px bg-border lg:block" />
        <Link href={href(sev, ar, !onlyOpen)} className={cn("chip", onlyOpen && "is-active")} title="Hide findings that already have an adjustment or a judgment">
          Open only
          {addressed ? <span className="count">{run.findings.length - addressed}</span> : null}
        </Link>
        <span className="mt-1.5 hidden h-5 w-px bg-border lg:block" />
        <div className="flex flex-wrap gap-1.5">
          <Link href={href(sev, null)} className={cn("chip", !ar && "is-active")}>
            Every area
          </Link>
          {areas.map((a) => {
            const n = run.findings.filter((f) => f.area === a && f.severity === "error").length;
            const total = run.findings.filter((f) => f.area === a).length;
            return (
              <Link key={a} href={href(sev, a)} className={cn("chip", ar === a && "is-active")}>
                {AREA_LABELS[a]}
                {total ? <span className={cn("count", n && "danger")}>{n || total}</span> : null}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        {withFindings.map((r) => {
          const shown = r.findings.filter((f) => (!sev || f.severity === sev) && (!onlyOpen || isOpen(f)));
          const worst: Severity = r.findings.some((f) => f.severity === "error") ? "error" : r.findings.some((f) => f.severity === "warning") ? "warning" : "info";
          return (
            <Card
              key={r.check}
              title={
                <span className="flex items-center gap-2.5">
                  <SeverityIcon severity={worst} />
                  {r.title}
                  <Badge tone={worst === "error" ? "danger" : worst === "warning" ? "warn" : "neutral"}>
                    {r.findings.length} finding{r.findings.length === 1 ? "" : "s"}
                  </Badge>
                </span>
              }
              description={r.coverage}
              aside={<span className="chip pointer-events-none h-6">{AREA_LABELS[r.area]}</span>}
              flush
            >
              {shown.length ? (
                <ul className="divide-y divide-border">
                  {shown.map((f) => (
                    <FindingRow key={f.id} f={f} summary={ledger.summary("check:" + f.id)} resolved={resolved.has(f.id)} />
                  ))}
                </ul>
              ) : null}
            </Card>
          );
        })}

        {cleanVisible.length ? (
          <Card title={<span className="flex items-center gap-2.5"><CheckCircle2 className="h-4 w-4 text-ok" /> Clean checks</span>} description="These found nothing. Each still states what it examined, so a clean result proves coverage rather than silence." flush>
            <ul className="divide-y divide-border">
              {cleanVisible.map((r) => (
                <li key={r.check} className="flex items-start gap-3 px-5 py-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" strokeWidth={1.75} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium">{r.title}</span>
                      <span className="text-[11px] text-muted">{AREA_LABELS[r.area]}</span>
                    </div>
                    <p className="mt-0.5 text-[12.5px] leading-5 text-muted">{r.coverage}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {!ar || ar === "documents" ? (
          <Card
            title={
              <span className="flex items-center gap-2.5">
                Packet integrity
                {index.integrity.length ? <Badge tone="neutral">{index.integrity.length} notes</Badge> : <Badge tone="ok" dot>clean</Badge>}
              </span>
            }
            description="Every reference inside the packet must land on something that exists, and every stated count must agree with the records delivered."
            aside={<span className="chip pointer-events-none h-6">{AREA_LABELS.documents}</span>}
            flush
          >
            {index.integrity.length ? (
              <ul className="divide-y divide-border">
                {index.integrity.map((i, n) => (
                  <li key={n} className="flex gap-3 px-5 py-3">
                    <SeverityIcon severity={i.severity === "warning" ? "warning" : "info"} className="mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[13px]">{i.message}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] text-muted">{i.code}</span>
                        {i.refs.map((r) => (
                          <RefLink key={r} refId={r} />
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        ) : null}
      </div>
    </>
  );
}
