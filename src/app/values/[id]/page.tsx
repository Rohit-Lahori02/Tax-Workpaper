import { AlertTriangle, ArrowRight, Crosshair, FileText, ScanSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Marks } from "@/components/facts/fact-marks";
import { FactsPanel } from "@/components/facts/facts-panel";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, cn, Empty, KV, Pill, type Tone } from "@/components/ui";
import { factsContext } from "@/lib/facts/context";
import { getLedger } from "@/lib/facts/repo";
import { formShort } from "@/lib/forms";
import { fmtDateTime, fmtExtractedValue, fmtLineValue, fmtPct } from "@/lib/format";
import { maskAccount, maskSsn, maskText } from "@/lib/mask";
import { documentState } from "@/lib/packet/documents";
import { getPacket } from "@/lib/packet/load";
import { computeMarks } from "@/lib/packet/pagemarks";
import type { ExtractedValue } from "@/lib/packet/schema";
import { documentHref, lineHref } from "@/lib/refs";
import { logSensitiveView } from "@/lib/sensitive";
import { getViewer } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const v = getPacket().index.values.get(id);
  return { title: v ? id + " · " + v.label : id };
}

const LOW_CONFIDENCE = 0.8;
const SENSITIVE_TYPES = new Set(["ssn", "account_number"]);

const TYPE_TONE: Record<string, Tone> = {
  money: "accent",
  date: "neutral",
  text: "neutral",
  integer: "accent",
  quantity: "accent",
  percent: "accent",
  boolean: "neutral",
  code: "neutral",
  ssn: "warn",
  ein: "warn",
  account_number: "warn",
};

function shown(v: ExtractedValue, reveal: boolean): string {
  if (!reveal && v.value !== null) {
    if (v.value_type === "ssn") return maskSsn(String(v.value));
    if (v.value_type === "account_number") return maskAccount(String(v.value));
  }
  return fmtExtractedValue(v.value);
}

function asRead(v: ExtractedValue, reveal: boolean): string {
  if (!reveal) {
    if (v.value_type === "ssn") return maskSsn(v.text_as_read);
    if (v.value_type === "account_number") return maskAccount(v.text_as_read);
  }
  return v.text_as_read;
}

/** A few lines of the printed page around the value, with the value itself marked. */
function excerpt(text: string, start: number, end: number, radius = 160): { before: string; hit: string; after: string } {
  let s = Math.max(0, start - radius);
  let e = Math.min(text.length, end + radius);
  // Snap to line boundaries so the excerpt reads like the page does.
  const nl = text.lastIndexOf("\n", s);
  if (nl >= 0 && start - nl < radius * 2) s = nl + 1;
  const nr = text.indexOf("\n", e);
  if (nr >= 0 && nr - end < radius * 2) e = nr;
  return { before: (s > 0 ? "… " : "") + text.slice(s, start), hit: text.slice(start, end), after: text.slice(end, e) + (e < text.length ? " …" : "") };
}

export default async function ValuePage({ params }: Props) {
  const { id } = await params;
  const { index } = getPacket();
  const value = index.values.get(id);
  if (!value) notFound();

  const [{ actor, reveal, literals }, { ledger }, ctx] = await Promise.all([getViewer(), getLedger(), factsContext()]);
  const doc = index.documents.get(value.document_id) ?? null;
  const version = index.latestVersion;
  const sensitive = SENSITIVE_TYPES.has(value.value_type);
  if (reveal && sensitive) logSensitiveView(actor, "/values/" + value.id, [value.id]);

  // Where the value sits on the printed page, on the same (possibly masked) text the viewer shows.
  const pageText = doc?.pages.find((p) => p.page === value.page)?.printed_content ?? null;
  const masked = pageText === null ? null : reveal ? pageText : maskText(pageText, literals);
  const mark = masked === null ? null : (computeMarks(masked, [{ id: value.id, text: asRead(value, reveal), position: value.position }]).marks[0] ?? null);
  const located = mark !== null;
  const ex = masked !== null && mark ? excerpt(masked, mark.start, mark.end) : null;

  // Where it went: every line that cites it, newest version first, with that version's value.
  const cites = (index.linesByValue.get(value.id) ?? []).slice().sort((a, b) => index.versionOrder.indexOf(b.version) - index.versionOrder.indexOf(a.version) || a.key.localeCompare(b.key));
  const citesNow = cites.filter((c) => c.version === version);
  const citesBefore = cites.filter((c) => c.version !== version);

  // Company on the page: the other values read from the same page, in reading order.
  const siblings = (index.valuesByDocument.get(value.document_id) ?? [])
    .filter((v) => v.page === value.page && v.id !== value.id)
    .sort((a, b) => a.position.y0 - b.position.y0 || a.position.x0 - b.position.x0);
  const onDoc = index.valuesByDocument.get(value.document_id)?.length ?? 0;

  const summary = ledger.summary(value.id);
  const state = doc ? documentState(doc, index, version) : null;
  const lowConfidence = value.confidence < LOW_CONFIDENCE;
  const openHref = documentHref(value.document_id, { page: value.page, value: value.id });
  const lineMap = (ver: string) => index.lines.get(ver);
  const display = shown(value, reveal);
  const groups: [string, typeof cites][] = [
    ["Working version · " + version, citesNow],
    ["Earlier versions", citesBefore],
  ];

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-1.5">
            <Link href="/documents" className="hover:underline">
              Documents
            </Link>
            <span className="text-border-strong">/</span>
            {doc ? (
              <Link href={documentHref(doc.id)} className="font-mono hover:underline">
                {doc.id}
              </Link>
            ) : (
              <span className="font-mono">{value.document_id}</span>
            )}
            <span className="text-border-strong">/</span>
            <span>page {value.page}</span>
            <span className="text-border-strong">/</span>
            <span className="font-mono">{value.id}</span>
          </span>
        }
        title={value.label}
        description={
          doc ? (
            <>
              Read from <span className="font-medium text-foreground">{doc.title}</span> ({doc.issuer}), page {value.page} of {doc.page_count}. A value is what the extraction pipeline read off a page; it never changes. The return lines it feeds are listed below, with what became of them.
            </>
          ) : (
            "The document this value was read from is not in the packet."
          )
        }
        meta={
          <>
            <Badge tone={TYPE_TONE[value.value_type] ?? "neutral"}>{value.value_type.replace(/_/g, " ")}</Badge>
            <Badge tone={value.confidence < 0.6 ? "danger" : lowConfidence ? "warn" : "ok"} dot>
              read at {fmtPct(value.confidence)}
            </Badge>
            {!located ? (
              <Badge tone="warn" dot>
                not found on the page
              </Badge>
            ) : null}
            {citesNow.length ? (
              <Badge tone="accent" dot>
                feeds {citesNow.length} line{citesNow.length === 1 ? "" : "s"} in {version}
              </Badge>
            ) : (
              <Badge tone="neutral">no return line cites this</Badge>
            )}
            {state === "superseded" ? (
              <Badge tone="danger" dot>
                document superseded
              </Badge>
            ) : null}
            {doc?.marked_corrected ? <Badge tone="warn">corrected form</Badge> : null}
            {sensitive && !reveal ? <Badge tone="warn">masked</Badge> : null}
            <Marks s={summary} />
          </>
        }
        actions={
          <Pill href={openHref} primary icon={<ScanSearch className="h-3.5 w-3.5" />}>
            Open on page {value.page}
          </Pill>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid content-start gap-4 xl:col-span-2">
          {/* The value, big, with what the pipeline actually read beside it. */}
          <section className="card overflow-hidden">
            <div className="grid gap-0 md:grid-cols-[1fr_auto]">
              <div className="p-5">
                <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Value as parsed</div>
                {value.value === null ? (
                  <div className="mt-2 text-[22px] font-semibold leading-none tracking-[-0.01em] text-muted">Nothing printed</div>
                ) : (
                  <div className={cn("mt-2 break-words font-mono font-semibold leading-none tracking-[-0.02em] tabular-nums", display.length > 18 ? "text-[22px] leading-7" : "text-[36px]")}>{display}</div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
                  <span>
                    read as <span className="font-mono text-foreground">&ldquo;{asRead(value, reveal) || "(nothing)"}&rdquo;</span>
                  </span>
                  <span>
                    field <span className="font-mono text-foreground">{value.field}</span>
                  </span>
                </div>
              </div>
              <div className="grid min-w-[220px] content-start gap-3 border-t border-border bg-surface-2/40 p-5 md:border-l md:border-t-0">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Read confidence</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                      <span className={cn("block h-full rounded-full", value.confidence < 0.6 ? "bg-danger" : lowConfidence ? "bg-warn" : "bg-ok")} style={{ width: Math.round(value.confidence * 100) + "%" }} />
                    </span>
                    <span className={cn("font-mono text-[12px] font-medium tabular-nums", lowConfidence ? "text-warn" : "text-foreground")}>{fmtPct(value.confidence)}</span>
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-4 text-muted">{lowConfidence ? "Below the firm's 80% bar. Check it against the page before relying on it." : "Above the firm's 80% bar."}</p>
                </div>
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Position on page</div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="relative block h-14 w-11 shrink-0 overflow-hidden rounded-[3px] border border-border bg-surface">
                      <span
                        className={cn("absolute rounded-[1px]", located ? "bg-accent" : "bg-warn")}
                        style={{
                          left: Math.round(value.position.x0 * 100) + "%",
                          top: Math.round(value.position.y0 * 100) + "%",
                          width: Math.max(4, Math.round((value.position.x1 - value.position.x0) * 100)) + "%",
                          height: Math.max(3, Math.round((value.position.y1 - value.position.y0) * 100)) + "%",
                        }}
                      />
                    </span>
                    <span className="font-mono text-[10.5px] leading-4 text-muted">
                      x {value.position.x0.toFixed(2)}–{value.position.x1.toFixed(2)}
                      <br />y {value.position.y0.toFixed(2)}–{value.position.y1.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {!located ? (
              <div className="flex items-start gap-2 border-t border-warn/30 bg-warn-soft px-5 py-3 text-[12.5px] leading-5 text-warn">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  The text the pipeline read, <span className="font-mono">{asRead(value, reveal) || "(nothing)"}</span>, is not printed on page {value.page}. Treat this value as unverified until someone has looked at the page.
                </span>
              </div>
            ) : null}
          </section>

          {/* The printed context around the value. */}
          <Card
            title="On the page"
            description={doc ? "The printed text around the value, exactly as the viewer shows it. The highlighted span is what the pipeline read." : undefined}
            aside={
              <Link href={openHref} className="flex items-center gap-1 text-accent hover:underline">
                full page <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {ex ? (
              <pre className="scroll-thin overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-2/40 px-4 py-3 font-mono text-[12px] leading-5">
                <span className="text-muted">{ex.before}</span>
                <mark className="ev is-selected">{ex.hit}</mark>
                <span className="text-muted">{ex.after}</span>
              </pre>
            ) : (
              <Empty>{doc ? "Nothing on page " + value.page + " matches the text as read, so there is no excerpt to show." : "The page text is not available."}</Empty>
            )}
          </Card>

          {/* Where it went. */}
          <Card
            title="Where it lands on the return"
            description="Every return line that cites this value as a source. The working version comes first; earlier versions are kept for the record."
            aside={cites.length + " citation" + (cites.length === 1 ? "" : "s")}
            flush
          >
            {cites.length === 0 ? (
              <div className="p-5">
                <Empty>No return line cites this value in any version. It was read, but nothing was built on it.</Empty>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {groups.map(([title, group]) =>
                  group.length ? (
                    <div key={title}>
                      <div className="bg-surface-2/50 px-5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</div>
                      <table className="tbl dense">
                        <tbody>
                          {group.map((c) => {
                            const l = lineMap(c.version)?.get(c.key);
                            return (
                              <tr key={c.version + c.key}>
                                <td className="w-36 pl-5">
                                  <RefLink refId={c.key} href={lineHref(c.key, c.version)} />
                                </td>
                                <td className="w-16 font-mono text-[11px] text-muted">{c.version}</td>
                                <td>
                                  <div className="font-medium">{l?.label ?? c.key}</div>
                                  {l ? (
                                    <div className="text-[11px] text-muted">
                                      {formShort(l.form)} line {l.line} · rule {l.rule}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="num font-semibold">{l ? fmtLineValue(l.value) : "—"}</td>
                                <td className="w-14 pr-5">
                                  <Marks s={ledger.summary(c.key)} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <FactsPanel target={value.id} facts={ledger.forTarget(value.id)} actor={ctx.actor} staff={ctx.staff} verificationTypes={ctx.verificationTypes} title="Evidence on this value" />

          {/* Where it came from. */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-2 text-muted ring-1 ring-inset ring-border">
                  <FileText className="h-3.5 w-3.5" />
                </span>
                Source document
              </span>
            }
          >
            {doc ? (
              <>
                <Link href={documentHref(doc.id)} className="text-[13.5px] font-semibold leading-5 hover:text-accent">
                  {doc.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                  <RefLink refId={doc.id} />
                  <span>{doc.document_type}</span>
                </div>
                <KV
                  className="mt-3 text-[12.5px]"
                  rows={[
                    ["Issuer", doc.issuer],
                    ["Belongs to", doc.belongs_to],
                    ["Received", fmtDateTime(doc.received_at) + " from the " + doc.uploaded_by],
                    ["Extraction", doc.extraction.status.replace(/_/g, " ") + " · " + onDoc + " value" + (onDoc === 1 ? "" : "s")],
                    [
                      "Status",
                      <span key="s" className="flex flex-wrap gap-1">
                        {state === "superseded" ? <Badge tone="danger">superseded</Badge> : state === "reached" ? <Badge tone="ok">reaches the return</Badge> : state === "unused" ? <Badge tone="neutral">unused</Badge> : <Badge tone="warn">not extracted</Badge>}
                        {doc.marked_corrected ? <Badge tone="warn">corrected</Badge> : null}
                      </span>,
                    ],
                  ]}
                />
              </>
            ) : (
              <Empty>Document {value.document_id} is missing from the packet.</Empty>
            )}
          </Card>

          {/* Neighbours on the same page. */}
          <Card title={"Also on page " + value.page} description={siblings.length ? "Other values read from the same page, in reading order." : undefined} aside={siblings.length ? siblings.length + " values" : undefined} flush>
            {siblings.length === 0 ? (
              <div className="p-5">
                <Empty>This is the only value read from page {value.page}.</Empty>
              </div>
            ) : (
              <ul className="scroll-thin max-h-[420px] divide-y divide-border overflow-auto">
                {siblings.map((s) => {
                  const feeds = (index.linesByValue.get(s.id) ?? []).some((l) => l.version === version);
                  return (
                    <li key={s.id}>
                      <Link href={"/values/" + s.id} className="flex items-center gap-3 px-5 py-2 hover:bg-surface-2/60">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium">{s.label}</span>
                          <span className="block truncate font-mono text-[10.5px] text-muted">
                            {s.id} · {s.field}
                          </span>
                        </span>
                        <span className={cn("shrink-0 font-mono text-[12px] tabular-nums", feeds ? "text-foreground" : "text-muted")}>{shown(s, reveal)}</span>
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.confidence < 0.6 ? "bg-danger" : s.confidence < LOW_CONFIDENCE ? "bg-warn" : "bg-ok")} title={"Read confidence " + fmtPct(s.confidence)} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="flex items-start gap-2 px-1 text-[11.5px] leading-4 text-muted">
            <Crosshair className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <span>Sensitive identifiers stay masked unless the file is switched to reveal, and every reveal is logged. Verify, note, ask or attach from the evidence panel; the record goes on this value, not on the document.</span>
          </div>
        </div>
      </div>
    </>
  );
}
