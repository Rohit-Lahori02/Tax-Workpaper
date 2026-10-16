import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EffectBadge, SEVERITY_TONE } from "@/components/checks/finding-row";
import { FactsPanel } from "@/components/facts/facts-panel";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, KV } from "@/components/ui";
import { runChecks } from "@/lib/checks/run";
import { AREA_LABELS } from "@/lib/checks/types";
import { factsContext } from "@/lib/facts/context";
import { getLedger } from "@/lib/facts/repo";
import { describeRef } from "@/lib/packet/describe";
import { getPacket } from "@/lib/packet/load";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: "Check · " + decodeURIComponent(id) };
}

export default async function FindingPage({ params }: Props) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const { packet, index } = getPacket();
  const run = runChecks(packet, index);
  const f = run.findings.find((x) => x.id === id);
  if (!f) notFound();
  const result = run.results.find((r) => r.check === f.check)!;
  const [{ ledger }, ctx] = await Promise.all([getLedger(), factsContext()]);
  const target = "check:" + f.id;

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/checks" className="hover:underline">
              Checks
            </Link>
            <span>/</span>
            <Link href={"/checks?area=" + f.area} className="hover:underline">
              {AREA_LABELS[f.area]}
            </Link>
            <span>/</span>
            <span>{result.title}</span>
          </span>
        }
        title={f.title}
        description={f.detail}
        meta={
          <>
            <Badge tone={SEVERITY_TONE[f.severity]} dot>
              {f.severity}
            </Badge>
            <EffectBadge effect={f.effect} />
            <span className="font-mono text-[11px] text-muted">{target}</span>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid content-start gap-4 xl:col-span-2">
          {f.expected !== undefined || f.actual !== undefined || f.difference !== undefined ? (
            <Card title="Numbers">
              <KV
                rows={[
                  ...(f.actual !== undefined ? ([["On the return", <span key="a" className="font-mono tabular-nums">{f.actual}</span>]] as [string, React.ReactNode][]) : []),
                  ...(f.expected !== undefined ? ([["Evidence says", <span key="e" className="font-mono tabular-nums">{f.expected}</span>]] as [string, React.ReactNode][]) : []),
                  ...(f.difference !== undefined ? ([["Difference", <span key="d" className="font-mono tabular-nums">{f.difference > 0 ? "+" : ""}{Math.round(f.difference * 100) / 100}</span>]] as [string, React.ReactNode][]) : []),
                ]}
              />
            </Card>
          ) : null}
          <Card title="Evidence" description="Everything this finding rests on. Each link opens the record itself." flush>
            <ul className="divide-y divide-border">
              {f.refs.map((r) => {
                const d = describeRef(r, packet, index);
                return (
                  <li key={r} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2">
                    <RefLink refId={r} className="w-40 shrink-0" />
                    <span className="min-w-0 text-[13px]">{d.label}</span>
                    {d.detail ? <span className="min-w-0 text-[12px] text-muted">{d.detail}</span> : null}
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card title="What this check does" description={result.coverage}>
            <p className="text-[13px] text-muted">
              Check <span className="font-mono">{f.check}</span>. {result.findings.length} finding{result.findings.length === 1 ? "" : "s"} in {run.version}.
            </p>
          </Card>
        </div>
        <FactsPanel
          target={target}
          facts={ledger.forTarget(target)}
          actor={ctx.actor}
          staff={ctx.staff}
          verificationTypes={ctx.verificationTypes}
          title="Resolution"
        />
      </div>
    </>
  );
}
