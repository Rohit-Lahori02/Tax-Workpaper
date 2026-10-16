import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { FormNav, formsInVersion } from "@/components/return/form-nav";
import { VersionSwitch } from "@/components/return/version-switch";
import { Badge, Card } from "@/components/ui";
import { formLabel, formShort } from "@/lib/forms";
import { fmtLineValue, fmtMoney, fmtPct } from "@/lib/format";
import { getPacket } from "@/lib/packet/load";
import { lineHref } from "@/lib/refs";
import { variance } from "@/lib/variance";

type Props = { params: Promise<{ form: string }>; searchParams: Promise<{ v?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { form } = await params;
  return { title: formShort(decodeURIComponent(form)) };
}

export default async function FormPage({ params, searchParams }: Props) {
  const { form: rawForm } = await params;
  const { v } = await searchParams;
  const form = decodeURIComponent(rawForm);
  const { packet, index } = getPacket();
  const version = v && index.versions.has(v) ? v : index.latestVersion;
  const all = [...(index.lines.get(version)?.values() ?? [])];
  const lines = all.filter((l) => l.form === form);
  if (lines.length === 0) notFound();

  const forms = formsInVersion(index, version);
  const jurisdiction = lines[0].jurisdiction;
  const withPrior = lines.filter((l) => index.priorYearLines.has(l.key)).length;
  const flagged = lines.filter((l) => {
    const prior = index.priorYearLines.get(l.key);
    return prior && typeof prior.value === "number" && typeof l.value === "number" && variance(l.value, prior.value, packet).flagged;
  }).length;
  const rule = packet.firm.starter_standards.variance_review;

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/return" className="hover:underline">
              Return
            </Link>
            <span>/</span>
            <span className="capitalize">{jurisdiction}</span>
          </span>
        }
        title={formLabel(form)}
        description={
          lines.length +
          " lines in " +
          version +
          ". " +
          (withPrior
            ? withPrior + " have a 2024 counterpart; " + flagged + " moved more than " + rule.flag_if_change_over_percent + "% and " + fmtMoney(rule.and_over_amount) + "."
            : "No line on this form has a 2024 counterpart.")
        }
        actions={<VersionSwitch versions={index.versionOrder} current={version} latest={index.latestVersion} href={(x) => "/return/" + encodeURIComponent(form) + "?v=" + x} />}
      />

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <FormNav forms={forms} active={form} version={version} />
        <Card flush>
          <div className="overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Label</th>
                  <th className="num">{version}</th>
                  <th className="num">2024</th>
                  <th className="num">Change</th>
                  <th className="num">Sources</th>
                  <th>Rule</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const prior = index.priorYearLines.get(l.key);
                  const numeric = typeof l.value === "number" && prior && typeof prior.value === "number";
                  const vr = numeric ? variance(l.value as number, prior.value as number, packet) : null;
                  const inputs = l.inputs.length;
                  return (
                    <tr key={l.key}>
                      <td className="whitespace-nowrap">
                        <RefLink refId={l.key} href={lineHref(l.key, version)}>
                          {l.line}
                        </RefLink>
                      </td>
                      <td className="max-w-xl">
                        <Link href={lineHref(l.key, version)} className="hover:underline">
                          {l.label}
                        </Link>
                        {l.note ? (
                          <span className="ml-1.5 text-muted" title={l.note}>
                            ⓘ
                          </span>
                        ) : null}
                      </td>
                      <td className="num font-medium">{fmtLineValue(l.value)}</td>
                      <td className="num text-muted">{prior ? fmtLineValue(prior.value) : "—"}</td>
                      <td className="num">
                        {vr ? (
                          <span className={vr.flagged ? "text-warn" : "text-muted"}>
                            {(vr.diff > 0 ? "+" : "") + fmtLineValue(vr.diff)}
                            {vr.pct !== null ? <span className="ml-1 text-[11px]">({fmtPct(vr.pct)})</span> : null}
                            {vr.flagged ? (
                              <Badge tone="warn" className="ml-1.5">
                                swing
                              </Badge>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="num text-muted">
                        {l.sources.length ? l.sources.length : inputs ? <span title={inputs + " input lines"}>{inputs} inputs</span> : "—"}
                      </td>
                      <td>
                        <span className="font-mono text-[11px] text-muted" title={packet.engine_reference.rules[l.rule]}>
                          {l.rule}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
