import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdjustmentForm } from "@/components/adjust/adjustment-form";
import { Marks } from "@/components/facts/fact-marks";
import { FactsPanel } from "@/components/facts/facts-panel";
import { BuildTree } from "@/components/lines/build-tree";
import { categoryFor, effectiveReturn, partnerThreshold } from "@/lib/effective";
import { canAdjust } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { VersionSwitch } from "@/components/return/version-switch";
import { Badge, Card, Empty, KV, SectionTitle } from "@/components/ui";
import { factsContext } from "@/lib/facts/context";
import { getLedger } from "@/lib/facts/repo";
import { formLabel, formShort } from "@/lib/forms";
import { fmtExtractedValue, fmtLineValue, fmtPct } from "@/lib/format";
import { getPacket } from "@/lib/packet/load";
import type { ExtractedValue, PacketDocument } from "@/lib/packet/schema";
import { documentHref, lineHref, parseRef } from "@/lib/refs";
import { variance } from "@/lib/variance";

type Props = { params: Promise<{ key: string }>; searchParams: Promise<{ v?: string; adjust?: string; reason?: string; from?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  return { title: decodeURIComponent(key) };
}

export default async function LinePage({ params, searchParams }: Props) {
  const { key: rawKey } = await params;
  const { v, adjust, reason, from } = await searchParams;
  const key = decodeURIComponent(rawKey);
  const { packet, index } = getPacket();

  const presentIn = index.versionOrder.filter((ver) => index.lines.get(ver)?.has(key));
  const priorYear = index.priorYearLines.get(key) ?? null;
  if (presentIn.length === 0 && !priorYear) notFound();

  const [{ ledger }, ctx] = await Promise.all([getLedger(), factsContext()]);
  const version = v && presentIn.includes(v) ? v : presentIn[presentIn.length - 1];
  const line = version ? index.lines.get(version)!.get(key)! : null;
  const dependents = version ? (index.dependents.get(version)?.get(key) ?? []) : [];
  const lineMap = version ? index.lines.get(version) : undefined;
  const summary = ledger.summary(key);
  const eff = effectiveReturn(packet, index, ledger);
  const w = version === index.latestVersion ? eff.lines.get(key) : undefined;
  const workingValue = w && w.kind !== "blocked" && typeof w.working === "number" ? w.working : typeof line?.value === "number" ? line.value : null;

  // Sources grouped by document.
  const byDoc = new Map<string, { document: PacketDocument | null; values: ExtractedValue[] }>();
  const otherSources: string[] = [];
  for (const s of line?.sources ?? []) {
    const ref = parseRef(s);
    if (ref.kind === "value") {
      const val = index.values.get(ref.id);
      if (!val) {
        otherSources.push(s);
        continue;
      }
      const g = byDoc.get(val.document_id) ?? { document: index.documents.get(val.document_id) ?? null, values: [] };
      g.values.push(val);
      byDoc.set(val.document_id, g);
    } else {
      otherSources.push(s);
    }
  }

  const changes = index.versionOrder
    .map((ver) => ({ version: ver, change: index.versions.get(ver)!.changes_from_previous.find((c) => c.key === key) }))
    .filter((c) => c.change);
  const diagnostics = version
    ? index.versions.get(version)!.diagnostics.filter((d) => d.refs.some((r) => r === key || r.startsWith(key + ".")))
    : [];
  const vr =
    line && priorYear && typeof line.value === "number" && typeof priorYear.value === "number"
      ? variance(line.value, priorYear.value, packet)
      : null;

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/return" className="hover:underline">
              Return
            </Link>
            <span>/</span>
            {line ? (
              <Link href={"/return/" + encodeURIComponent(line.form) + "?v=" + version} className="hover:underline">
                {formLabel(line.form)}
              </Link>
            ) : (
              <span>{formLabel(key.split(".")[0])}</span>
            )}
            <span>/</span>
            <span className="font-mono">{key}</span>
          </span>
        }
        title={line?.label ?? priorYear?.label ?? key}
        description={line ? packet.engine_reference.rules[line.rule] : "This line exists only on the 2024 return as filed."}
        meta={
          line ? (
            <>
              {w && w.kind !== "blocked" ? (
                <span className="flex items-baseline gap-2">
                  <span className="text-[26px] font-semibold leading-none tabular-nums tracking-tight">{fmtLineValue(w.working)}</span>
                  <span className="text-[13px] text-muted">
                    working · engine <span className="line-through">{fmtLineValue(line.value)}</span>
                  </span>
                  <Badge tone={w.kind === "adjusted" ? "accent" : "neutral"} dot>
                    {w.kind}
                  </Badge>
                </span>
              ) : (
                <span className="text-[26px] font-semibold leading-none tabular-nums tracking-tight">{fmtLineValue(line.value)}</span>
              )}
              {w && w.kind === "blocked" ? (
                <Badge tone="warn" dot>
                  inputs changed; needs engine rerun
                </Badge>
              ) : null}
              <Badge tone="accent" mono>
                {line.rule}
              </Badge>
              <Badge className="capitalize">{line.jurisdiction}</Badge>
              {vr?.flagged ? (
                <Badge tone="warn" dot>
                  swing vs 2024: {(vr.diff > 0 ? "+" : "") + fmtLineValue(vr.diff)}
                </Badge>
              ) : null}
              <Marks s={summary} />
              {line.note ? <span className="text-xs text-muted">{line.note}</span> : null}
            </>
          ) : null
        }
        actions={
          presentIn.length ? (
            <VersionSwitch versions={presentIn} current={version} latest={index.latestVersion} href={(x) => lineHref(key, x)} />
          ) : null
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid content-start gap-4 xl:col-span-2">
          <Card title="How this number is built" description="Expand any input to keep walking down. Lines with sources come straight from documents.">
            {line ? <BuildTree rootKey={key} version={version} index={index} /> : <Empty>No computation for a prior-year-only line.</Empty>}
          </Card>

          <Card
            title="Sources"
            description="The extracted values this line cites, grouped by the document they were read from."
            aside={line ? line.sources.length + " cited" : undefined}
            flush
          >
            {byDoc.size === 0 && otherSources.length === 0 ? (
              <div className="p-4">
                <Empty>No direct sources. The value is computed from the inputs above.</Empty>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {[...byDoc.entries()].map(([docId, g]) => (
                  <div key={docId} className="px-4 py-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <RefLink refId={docId} />
                      <Link href={documentHref(docId)} className="text-[13px] font-medium hover:underline">
                        {g.document?.title ?? "missing document"}
                      </Link>
                      {g.document?.marked_corrected ? <Badge tone="warn">CORRECTED</Badge> : null}
                      {g.document && index.documentUsage.get(docId)?.supersededIn.length ? <Badge tone="danger">superseded</Badge> : null}
                    </div>
                    <table className="tbl dense">
                      <tbody>
                        {g.values.map((val) => (
                          <tr key={val.id}>
                            <td className="w-24">
                              <RefLink refId={val.id} href={documentHref(val.document_id, { page: val.page, value: val.id })} />
                            </td>
                            <td className="w-16 text-muted">p.{val.page}</td>
                            <td>{val.label}</td>
                            <td className="num font-medium">{fmtExtractedValue(val.value)}</td>
                            <td className="num w-20">
                              <span className={val.confidence < 0.8 ? "text-warn" : "text-muted"}>{fmtPct(val.confidence)}</span>
                            </td>
                            <td className="w-16">
                              <Marks s={ledger.summary(val.id)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                {otherSources.length ? (
                  <div className="px-4 py-3">
                    <SectionTitle>Other sources</SectionTitle>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1">
                      {otherSources.map((s) => (
                        <li key={s}>
                          <RefLink refId={s} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-4">
          {line && typeof line.value === "number" && version === index.latestVersion && canAdjust(ctx.actor) ? (
            <AdjustmentForm
              target={key}
              engineValue={line.value}
              workingValue={workingValue ?? line.value}
              defaultCategory={categoryFor(key, line)}
              rates={index.versions.get(version)!.tax_effect_rates}
              partnerThreshold={partnerThreshold(packet)}
              prefill={adjust || reason ? { newValue: adjust, reason, fromFinding: from } : undefined}
            />
          ) : null}
          <FactsPanel
            target={key}
            facts={ledger.forTarget(key)}
            actor={ctx.actor}
            staff={ctx.staff}
            verificationTypes={ctx.verificationTypes}
          />

          <Card title="Across versions" flush>
            <table className="tbl dense">
              <tbody>
                {priorYear ? (
                  <tr>
                    <td className="text-muted">2024 as filed</td>
                    <td className="num">{fmtLineValue(priorYear.value)}</td>
                    <td className="text-right">{priorYear.source ? <RefLink refId={priorYear.source} /> : null}</td>
                  </tr>
                ) : null}
                {index.versionOrder.map((ver) => {
                  const l = index.lines.get(ver)?.get(key);
                  return (
                    <tr key={ver} className={ver === version ? "is-active" : ""}>
                      <td>
                        <Link href={lineHref(key, ver)} className="hover:underline">
                          {ver}
                        </Link>
                      </td>
                      <td className="num">{l ? fmtLineValue(l.value) : <span className="text-muted">not present</span>}</td>
                      <td className="text-right font-mono text-[11px] text-muted">{l?.rule ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <Card title="Changes between versions">
            {changes.length === 0 ? (
              <Empty>Unchanged across all engine runs.</Empty>
            ) : (
              <ul className="grid gap-1.5 text-[13px]">
                {changes.map(({ version: ver, change }) => (
                  <li key={ver} className="flex items-baseline justify-between gap-3">
                    <span>
                      <span className="font-medium">{ver}</span> <span className="text-muted">{change!.change}</span>
                    </span>
                    <span className="font-mono text-xs tabular-nums">
                      {change!.change === "added"
                        ? String(change!.new)
                        : change!.change === "removed"
                          ? String(change!.old)
                          : String(change!.old) + " → " + String(change!.new)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={"Feeds into" + (version ? " · " + version : "")}>
            {dependents.length === 0 ? (
              <Empty>No other line uses this one as an input.</Empty>
            ) : (
              <ul className="grid gap-1 text-[13px]">
                {dependents.map((k) => (
                  <li key={k} className="flex items-baseline gap-2">
                    <RefLink refId={k} href={lineHref(k, version)} />
                    <span className="min-w-0 truncate text-muted">{lineMap?.get(k)?.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {diagnostics.length ? (
            <Card title="Engine diagnostics on this line">
              <ul className="grid gap-2 text-[13px]">
                {diagnostics.map((d) => (
                  <li key={d.code}>
                    <Badge tone={d.severity === "warning" ? "warn" : "neutral"} mono>
                      {d.code}
                    </Badge>
                    <p className="mt-1">{d.message}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {line ? (
            <Card title="Identity">
              <KV
                rows={[
                  ["Form", formShort(line.form)],
                  ["Line", line.line],
                  ["Jurisdiction", line.jurisdiction],
                  ["Key", <span key="k" className="font-mono text-xs">{line.key}</span>],
                ]}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
