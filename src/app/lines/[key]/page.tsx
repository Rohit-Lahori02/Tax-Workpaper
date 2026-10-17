import { ArrowDownRight, ArrowUpRight, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdjustmentForm } from "@/components/adjust/adjustment-form";
import { Marks } from "@/components/facts/fact-marks";
import { FactsPanel } from "@/components/facts/facts-panel";
import { BuildTree } from "@/components/lines/build-tree";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { VersionSwitch } from "@/components/return/version-switch";
import { Badge, Card, cn, Empty, SectionTitle } from "@/components/ui";
import { categoryFor, effectiveReturn, partnerThreshold } from "@/lib/effective";
import { factsContext } from "@/lib/facts/context";
import { getLedger } from "@/lib/facts/repo";
import { formLabel, formShort } from "@/lib/forms";
import { fmtExtractedValue, fmtLineValue, fmtPct } from "@/lib/format";
import type { ExtractedValue, PacketDocument } from "@/lib/packet/schema";
import { canAdjust } from "@/lib/permissions";
import { documentHref, lineHref, parseRef } from "@/lib/refs";
import { getEffectivePacket } from "@/lib/standards-server";
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
  const { packet, index } = await getEffectivePacket();

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
  const changed = Boolean(w && w.kind !== "blocked");
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

  const changes = index.versionOrder.map((ver) => ({ version: ver, change: index.versions.get(ver)!.changes_from_previous.find((c) => c.key === key) })).filter((c) => c.change);
  const diagnostics = version ? index.versions.get(version)!.diagnostics.filter((d) => d.refs.some((r) => r === key || r.startsWith(key + "."))) : [];
  const vr = line && priorYear && typeof line.value === "number" && typeof priorYear.value === "number" ? variance(line.value, priorYear.value, packet) : null;
  const sourceCount = byDoc.size ? [...byDoc.values()].reduce((n, g) => n + g.values.length, 0) : 0;

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/return" className="hover:text-foreground">
              Return
            </Link>
            <span className="text-border-strong">/</span>
            {line ? (
              <Link href={"/return/" + encodeURIComponent(line.form) + "?v=" + version} className="hover:text-foreground">
                {formLabel(line.form)}
              </Link>
            ) : (
              <span>{formLabel(key.split(".")[0])}</span>
            )}
            <span className="text-border-strong">/</span>
            <span className="font-mono">{line?.line ?? key}</span>
          </span>
        }
        title={line?.label ?? priorYear?.label ?? key}
        description={line ? packet.engine_reference.rules[line.rule] : "This line exists only on the 2024 return as filed."}
        meta={
          line ? (
            <>
              <Badge tone="accent" mono>
                {line.rule}
              </Badge>
              <Badge className="capitalize">{line.jurisdiction}</Badge>
              <Badge mono>{line.key}</Badge>
              <Marks s={summary} />
              {line.note ? <span className="text-[12px] text-muted">{line.note}</span> : null}
            </>
          ) : null
        }
        actions={presentIn.length ? <VersionSwitch versions={presentIn} current={version} latest={index.latestVersion} href={(x) => lineHref(key, x)} /> : null}
      />

      {line ? (
        <div className="card mb-4 grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <div className="px-5 py-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{changed ? "Engine · " + version : "Value · " + version}</div>
            <div className={cn("mt-2 font-mono text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums", changed && "text-muted line-through decoration-border-strong")}>{fmtLineValue(line.value)}</div>
            <div className="mt-2 text-[12px] text-muted">{line.sources.length ? line.sources.length + " cited source" + (line.sources.length === 1 ? "" : "s") : line.inputs.length + " input line" + (line.inputs.length === 1 ? "" : "s")}</div>
          </div>
          <div className={cn("px-5 py-4", changed && "bg-accent-soft/40")}>
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              {changed ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
              Working
            </div>
            <div className="mt-2 font-mono text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{changed ? fmtLineValue(w!.working) : fmtLineValue(line.value)}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
              {changed ? (
                <>
                  <Badge tone={w!.kind === "adjusted" ? "accent" : "neutral"}>{w!.kind}</Badge>
                  <span className={w!.delta > 0 ? "text-warn" : "text-ok"}>{(w!.delta > 0 ? "+" : "") + fmtLineValue(Math.round(w!.delta * 100) / 100)} vs engine</span>
                </>
              ) : w && w.kind === "blocked" ? (
                <Badge tone="warn" dot>
                  inputs changed; needs engine rerun
                </Badge>
              ) : (
                "same as the engine"
              )}
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">2024 as filed</div>
            <div className="mt-2 font-mono text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground/80">{priorYear ? fmtLineValue(priorYear.value) : <span className="text-muted">—</span>}</div>
            <div className="mt-2 text-[12px] text-muted">{priorYear?.source ? <RefLink refId={priorYear.source} /> : "no counterpart on the 2024 return"}</div>
          </div>
          <div className={cn("px-5 py-4", vr?.flagged && "bg-warn-soft/40")}>
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              {vr?.flagged ? <span className="h-1.5 w-1.5 rounded-full bg-warn" /> : null}
              Change vs 2024
            </div>
            <div className={cn("mt-2 flex items-center gap-1.5 font-mono text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums", vr?.flagged ? "text-warn" : "")}>
              {vr ? (
                <>
                  {vr.diff > 0 ? <ArrowUpRight className="h-5 w-5" /> : vr.diff < 0 ? <ArrowDownRight className="h-5 w-5" /> : null}
                  {(vr.diff > 0 ? "+" : "") + fmtLineValue(vr.diff)}
                </>
              ) : (
                <span className="text-muted">—</span>
              )}
            </div>
            <div className="mt-2 text-[12px] text-muted">{vr ? (vr.pct !== null ? fmtPct(vr.pct) + (vr.flagged ? " · over the firm's swing threshold" : "") : "new this year") : "nothing to compare"}</div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid content-start gap-4 xl:col-span-2">
          <Card title="How this number is built" description="Expand any input to keep walking down. Lines with sources come straight from documents.">
            {line ? <BuildTree rootKey={key} version={version} index={index} /> : <Empty>No computation for a prior-year-only line.</Empty>}
          </Card>

          <Card title="Sources" description="The extracted values this line cites, grouped by the document they were read from. Click a value to see it highlighted on the page." aside={line ? sourceCount + " value" + (sourceCount === 1 ? "" : "s") + " · " + byDoc.size + " document" + (byDoc.size === 1 ? "" : "s") : undefined} flush>
            {byDoc.size === 0 && otherSources.length === 0 ? (
              <div className="p-5">
                <Empty>No direct sources. The value is computed from the inputs above.</Empty>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {[...byDoc.entries()].map(([docId, g]) => (
                  <div key={docId}>
                    <div className="flex flex-wrap items-center gap-2 bg-surface-2/50 px-5 py-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-surface text-muted ring-1 ring-inset ring-border">
                        <FileText className="h-3.5 w-3.5" />
                      </span>
                      <RefLink refId={docId} />
                      <Link href={documentHref(docId)} className="text-[13px] font-medium hover:text-accent">
                        {g.document?.title ?? "missing document"}
                      </Link>
                      {g.document ? <span className="text-[11.5px] text-muted">{g.document.document_type}</span> : null}
                      {g.document?.marked_corrected ? <Badge tone="warn">corrected</Badge> : null}
                      {g.document && index.documentUsage.get(docId)?.supersededIn.length ? <Badge tone="danger">superseded</Badge> : null}
                    </div>
                    <table className="tbl dense">
                      <tbody>
                        {g.values.map((val) => (
                          <tr key={val.id}>
                            <td className="w-28 pl-5">
                              <RefLink refId={val.id} href={documentHref(val.document_id, { page: val.page, value: val.id })} />
                            </td>
                            <td className="w-14 font-mono text-[11px] text-muted">p.{val.page}</td>
                            <td>
                              <div>{val.label}</div>
                              <div className="truncate font-mono text-[10.5px] text-muted">read as &ldquo;{val.text_as_read}&rdquo;</div>
                            </td>
                            <td className="num font-semibold">{fmtExtractedValue(val.value)}</td>
                            <td className="w-28">
                              <span className="flex items-center gap-2" title={"Read confidence " + fmtPct(val.confidence)}>
                                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-2">
                                  <span className={cn("block h-full rounded-full", val.confidence < 0.6 ? "bg-danger" : val.confidence < 0.8 ? "bg-warn" : "bg-ok")} style={{ width: Math.round(val.confidence * 100) + "%" }} />
                                </span>
                                <span className={cn("font-mono text-[11px] tabular-nums", val.confidence < 0.8 ? "text-warn" : "text-muted")}>{fmtPct(val.confidence)}</span>
                              </span>
                            </td>
                            <td className="w-16 pr-5">
                              <Marks s={ledger.summary(val.id)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                {otherSources.length ? (
                  <div className="px-5 py-3">
                    <SectionTitle>Other sources</SectionTitle>
                    <ul className="flex flex-wrap gap-1.5">
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

          {diagnostics.length ? (
            <Card title="Engine diagnostics on this line">
              <ul className="grid gap-2 text-[13px]">
                {diagnostics.map((d) => (
                  <li key={d.code} className="flex items-start gap-2">
                    <Badge tone={d.severity === "warning" ? "warn" : "neutral"} mono className="mt-0.5 shrink-0">
                      {d.code}
                    </Badge>
                    <p className="leading-5">{d.message}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
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
          <FactsPanel target={key} facts={ledger.forTarget(key)} actor={ctx.actor} staff={ctx.staff} verificationTypes={ctx.verificationTypes} />

          <Card title="Across versions" description="The same line on every engine run and on the 2024 return." flush>
            <table className="tbl dense">
              <tbody>
                {priorYear ? (
                  <tr>
                    <td className="pl-5 text-muted">2024 as filed</td>
                    <td className="num">{fmtLineValue(priorYear.value)}</td>
                    <td className="pr-5 text-right">{priorYear.source ? <RefLink refId={priorYear.source} /> : null}</td>
                  </tr>
                ) : null}
                {index.versionOrder.map((ver) => {
                  const l = index.lines.get(ver)?.get(key);
                  const ch = changes.find((c) => c.version === ver)?.change;
                  return (
                    <tr key={ver} className={ver === version ? "is-active" : ""}>
                      <td className="pl-5">
                        <Link href={lineHref(key, ver)} className="inline-flex items-center gap-1.5 font-medium hover:text-accent">
                          {ver === version ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                          {ver}
                        </Link>
                        {ch ? <span className="ml-1.5 text-[11px] text-muted">{ch.change}</span> : null}
                      </td>
                      <td className="num font-medium">{l ? fmtLineValue(l.value) : <span className="text-muted">not present</span>}</td>
                      <td className="pr-5 text-right font-mono text-[10.5px] text-muted">{l?.rule ?? ""}</td>
                    </tr>
                  );
                })}
                {changes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 text-[12px] text-muted">
                      Unchanged across all engine runs.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Card>

          <Card title={"Feeds into" + (version ? " · " + version : "")} description="Lines that use this one as an input.">
            {dependents.length === 0 ? (
              <Empty>No other line uses this one as an input.</Empty>
            ) : (
              <ul className="grid gap-1.5 text-[13px]">
                {dependents.map((k) => (
                  <li key={k} className="flex items-center gap-2">
                    <RefLink refId={k} href={lineHref(k, version)} />
                    <span className="min-w-0 truncate text-muted">{lineMap?.get(k)?.label}</span>
                    <span className="ml-auto shrink-0 font-mono text-[12px] tabular-nums">{lineMap?.get(k) ? fmtLineValue(lineMap.get(k)!.value) : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {line ? (
            <p className="px-1 text-[11.5px] text-muted">
              {formShort(line.form)} line {line.line} · {line.jurisdiction} · key <span className="font-mono">{line.key}</span>
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
