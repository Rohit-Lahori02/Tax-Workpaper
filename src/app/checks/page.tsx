import type { Metadata } from "next";
import Link from "next/link";
import { FindingRow } from "@/components/checks/finding-row";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, cn, Stat } from "@/components/ui";
import { runChecks } from "@/lib/checks/run";
import { AREA_LABELS, type Area, type Severity } from "@/lib/checks/types";
import { getLedger } from "@/lib/facts/repo";
import { fmtMoney } from "@/lib/format";
import { getPacket } from "@/lib/packet/load";

export const metadata: Metadata = { title: "Checks" };

type Props = { searchParams: Promise<{ severity?: string; area?: string }> };

export default async function ChecksPage({ searchParams }: Props) {
  const { severity, area } = await searchParams;
  const { packet, index } = getPacket();
  const { ledger } = await getLedger();
  const run = runChecks(packet, index);

  const sev = (["error", "warning", "info"] as Severity[]).includes(severity as Severity) ? (severity as Severity) : null;
  const ar = area && area in AREA_LABELS ? (area as Area) : null;

  const errors = run.findings.filter((f) => f.severity === "error");
  const effect = errors.reduce(
    (a, f) => ({ federal: a.federal + (f.effect?.federal ?? 0), california: a.california + (f.effect?.california ?? 0) }),
    { federal: 0, california: 0 },
  );
  const areas = (Object.keys(AREA_LABELS) as Area[]).filter((a) => run.results.some((r) => r.area === a));
  const rank = (r: (typeof run.results)[number]) => (r.findings.some((f) => f.severity === "error") ? 0 : r.findings.some((f) => f.severity === "warning") ? 1 : r.findings.length ? 2 : 3);
  const visible = run.results
    .filter((r) => (!ar || r.area === ar) && (!sev || r.findings.some((f) => f.severity === sev)))
    .sort((a, b) => rank(a) - rank(b) || areas.indexOf(a.area) - areas.indexOf(b.area));
  const href = (s: Severity | null, a: Area | null) => {
    const q = new URLSearchParams();
    if (s) q.set("severity", s);
    if (a) q.set("area", a);
    const qs = q.toString();
    return "/checks" + (qs ? "?" + qs : "");
  };
  const signed = (n: number) => (n === 0 ? "0" : (n > 0 ? "+" : "−") + fmtMoney(Math.abs(n)));

  return (
    <>
      <PageHeader
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
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Errors" value={run.counts.error} tone={run.counts.error ? "danger" : "ok"} hint="numbers the evidence contradicts" />
        <Stat label="Warnings" value={run.counts.warning} tone={run.counts.warning ? "warn" : undefined} hint="needs a person's judgment" />
        <Stat label="Information" value={run.counts.info} hint="worth knowing, no change implied" />
        <Stat
          label="If every error is corrected"
          value={
            <span className="text-[20px]">
              {signed(effect.federal)} <span className="text-[12px] font-normal text-muted">federal</span> · {signed(effect.california)}{" "}
              <span className="text-[12px] font-normal text-muted">CA</span>
            </span>
          }
          hint="estimated tax change from the engine's per-dollar rates"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {([null, "error", "warning", "info"] as (Severity | null)[]).map((s) => (
            <Link
              key={s ?? "all"}
              href={href(s, ar)}
              className={cn("rounded-full px-2.5 py-1 text-[12px] font-medium", sev === s ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-foreground")}
            >
              {s ? s[0].toUpperCase() + s.slice(1) + "s" : "All"}
            </Link>
          ))}
        </div>
        <span className="mx-1 h-4 w-px bg-border" />
        <div className="flex flex-wrap gap-1">
          <Link href={href(sev, null)} className={cn("rounded-full px-2.5 py-1 text-[12px] font-medium", !ar ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-foreground")}>
            Every area
          </Link>
          {areas.map((a) => {
            const n = run.findings.filter((f) => f.area === a && f.severity === "error").length;
            return (
              <Link
                key={a}
                href={href(sev, a)}
                className={cn("rounded-full px-2.5 py-1 text-[12px] font-medium", ar === a ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-foreground")}
              >
                {AREA_LABELS[a]}
                {n ? <span className="ml-1 text-danger">{n}</span> : null}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        {visible.map((r) => {
          const shown = r.findings.filter((f) => !sev || f.severity === sev);
          const worst = r.findings.some((f) => f.severity === "error") ? "error" : r.findings.some((f) => f.severity === "warning") ? "warning" : r.findings.length ? "info" : null;
          return (
            <Card
              key={r.check}
              title={
                <span className="flex items-center gap-2">
                  {r.title}
                  {worst ? (
                    <Badge tone={worst === "error" ? "danger" : worst === "warning" ? "warn" : "neutral"} dot>
                      {r.findings.length} finding{r.findings.length === 1 ? "" : "s"}
                    </Badge>
                  ) : (
                    <Badge tone="ok" dot>
                      clean
                    </Badge>
                  )}
                </span>
              }
              description={r.coverage}
              aside={<span className="font-mono text-[11px]">{AREA_LABELS[r.area]}</span>}
              flush
            >
              {shown.length ? (
                <ul className="divide-y divide-border">
                  {shown.map((f) => (
                    <FindingRow key={f.id} f={f} summary={ledger.summary("check:" + f.id)} />
                  ))}
                </ul>
              ) : null}
            </Card>
          );
        })}

        {!ar || ar === "documents" ? (
          <Card
            title={
              <span className="flex items-center gap-2">
                Packet integrity
                {index.integrity.length ? (
                  <Badge tone="neutral" dot>
                    {index.integrity.length} notes
                  </Badge>
                ) : (
                  <Badge tone="ok" dot>
                    clean
                  </Badge>
                )}
              </span>
            }
            description="Every reference inside the packet must land on something that exists, and every stated count must agree with the records delivered."
            aside={<span className="font-mono text-[11px]">{AREA_LABELS.documents}</span>}
            flush
          >
            {index.integrity.length ? (
              <ul className="divide-y divide-border">
                {index.integrity.map((i, n) => (
                  <li key={n} className="flex gap-3 px-4 py-2.5">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", i.severity === "warning" ? "bg-warn" : "bg-border-strong")} />
                    <div className="min-w-0">
                      <div className="text-[13px]">{i.message}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3">
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
