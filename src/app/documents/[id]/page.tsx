import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentViewer, type ViewerData, type ViewerValue } from "@/components/documents/document-viewer";
import { FactsPanel } from "@/components/facts/facts-panel";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, KV } from "@/components/ui";
import { factsContext } from "@/lib/facts/context";
import { getLedger } from "@/lib/facts/repo";
import type { FactView, TargetSummary } from "@/lib/facts/types";
import { fmtDateTime, fmtExtractedValue } from "@/lib/format";
import { maskAccount, maskSsn, maskText } from "@/lib/mask";
import { documentState, findReplacement } from "@/lib/packet/documents";
import { getPacket } from "@/lib/packet/load";
import { computeMarks, segmentText } from "@/lib/packet/pagemarks";
import type { ExtractedValue } from "@/lib/packet/schema";
import { documentHref } from "@/lib/refs";
import { logSensitiveView } from "@/lib/sensitive";
import { getViewer } from "@/lib/session";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; v?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { index } = getPacket();
  const doc = index.documents.get(id);
  return { title: doc ? id + " · " + doc.title : id };
}

const SENSITIVE_TYPES = new Set(["ssn", "account_number"]);

function displayValue(v: ExtractedValue, reveal: boolean): string {
  if (!reveal && v.value !== null) {
    if (v.value_type === "ssn") return maskSsn(String(v.value));
    if (v.value_type === "account_number") return maskAccount(String(v.value));
  }
  return fmtExtractedValue(v.value);
}

function textAsRead(v: ExtractedValue, reveal: boolean): string {
  if (!reveal) {
    if (v.value_type === "ssn") return maskSsn(v.text_as_read);
    if (v.value_type === "account_number") return maskAccount(v.text_as_read);
  }
  return v.text_as_read;
}

export default async function DocumentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { page: pageParam, v: valueParam } = await searchParams;
  const { packet, index } = getPacket();
  const doc = index.documents.get(id);
  if (!doc) notFound();

  const [{ actor, reveal, literals }, { ledger }, ctx] = await Promise.all([getViewer(), getLedger(), factsContext()]);
  const version = index.latestVersion;
  const lineMap = index.lines.get(version)!;
  const usage = index.documentUsage.get(doc.id)!;
  const state = documentState(doc, index, version);
  const replacement = findReplacement(doc, index);
  const values = index.valuesByDocument.get(doc.id) ?? [];

  // Unmasked sensitive data on this page is logged, per firm standard.
  if (reveal) {
    const sensitiveIds = values.filter((v) => SENSITIVE_TYPES.has(v.value_type)).map((v) => v.id);
    const allLiterals = Array.from(new Set([...packet.household.people.flatMap((p) => [p.ssn, p.ip_pin]).filter((x): x is string => Boolean(x))]));
    const textHit = doc.pages.some((p) => allLiterals.some((lit) => p.printed_content.includes(lit)));
    logSensitiveView(actor, "/documents/" + doc.id, [...sensitiveIds, ...(textHit ? ["page_text"] : [])]);
  }

  // Locate each value's text on its page, on the same (possibly masked) text the viewer shows.
  const located = new Set<string>();
  const pages = doc.pages.map((p) => {
    const text = reveal ? p.printed_content : maskText(p.printed_content, literals);
    const onPage = values.filter((v) => v.page === p.page).map((v) => ({ id: v.id, text: textAsRead(v, reveal), position: v.position }));
    const { marks } = computeMarks(text, onPage);
    for (const m of marks) located.add(m.valueId);
    return { page: p.page, segments: segmentText(text, marks) };
  });

  const viewerValues: ViewerValue[] = values
    .slice()
    .sort((a, b) => a.page - b.page || a.position.y0 - b.position.y0 || a.position.x0 - b.position.x0)
    .map((v) => ({
      id: v.id,
      page: v.page,
      field: v.field,
      label: v.label,
      display: displayValue(v, reveal),
      textAsRead: textAsRead(v, reveal),
      valueType: v.value_type,
      confidence: v.confidence,
      position: v.position,
      located: located.has(v.id),
      landsOn: (index.linesByValue.get(v.id) ?? [])
        .filter((l) => l.version === version)
        .map((l) => ({ key: l.key, label: lineMap.get(l.key)?.label ?? "" })),
    }));

  const facts: Record<string, FactView[]> = {};
  const summaries: Record<string, TargetSummary> = {};
  for (const v of values) {
    const s = ledger.summary(v.id);
    if (s.total) {
      summaries[v.id] = s;
      facts[v.id] = ledger.forTarget(v.id);
    }
  }

  const data: ViewerData = { docId: doc.id, title: doc.title, pageCount: doc.page_count, pages, values: viewerValues, version };
  const initialValue = valueParam && viewerValues.some((v) => v.id === valueParam) ? valueParam : null;
  const requestedPage = Number(pageParam);
  const initialPage = initialValue
    ? viewerValues.find((v) => v.id === initialValue)!.page
    : Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= doc.page_count
      ? requestedPage
      : 1;
  const linesReached = new Set(usage.linesReached.filter((l) => l.version === version).map((l) => l.key));
  const unlocated = viewerValues.filter((v) => !v.located).length;

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/documents" className="hover:underline">
              Documents
            </Link>
            <span className="text-border-strong">/</span>
            <span className="font-mono">{doc.id}</span>
          </span>
        }
        title={doc.title}
        description={
          <KV
            className="mt-1 !gap-x-4 !gap-y-1 text-[12.5px] sm:grid-cols-[max-content_1fr_max-content_1fr]"
            rows={[
              ["Issuer", doc.issuer],
              ["Type", doc.document_type],
              ["Belongs to", doc.belongs_to],
              ["Received", fmtDateTime(doc.received_at) + " from the " + doc.uploaded_by],
              ["File", <span key="f" className="font-mono text-[11.5px]">{doc.file_name}</span>],
              ["Used in", usage.usedIn.length ? usage.usedIn.join(", ") : "no version"],
            ]}
          />
        }
        meta={
          <>
            {state === "reached" ? (
              <Badge tone="ok" dot>
                feeds {linesReached.size} lines in {version}
              </Badge>
            ) : null}
            {state === "unused" ? (
              <Badge tone="warn" dot>
                reaches no line in {version}
              </Badge>
            ) : null}
            {state === "superseded" ? (
              <Badge tone="danger" dot>
                superseded in {usage.supersededIn.join(", ")}
                {replacement ? (
                  <>
                    {" "}
                    by <RefLink refId={replacement.id} className="text-inherit underline" />
                  </>
                ) : null}
              </Badge>
            ) : null}
            {doc.extraction.status !== "extracted" ? (
              <Badge tone={doc.extraction.status === "not_extracted" ? "danger" : "warn"}>
                {doc.extraction.status.replace("_", " ")}
                {doc.extraction.reason ? ": " + doc.extraction.reason : ""}
              </Badge>
            ) : null}
            {doc.marked_corrected ? <Badge tone="warn">marked CORRECTED by issuer</Badge> : null}
            {unlocated ? <Badge tone="warn">{unlocated} values not found on page as read</Badge> : null}
            {!reveal ? <Badge>sensitive numbers masked</Badge> : null}
          </>
        }
        actions={
          replacement ? (
            <Link href={documentHref(replacement.id)} className="pill primary">
              Open corrected version
            </Link>
          ) : null
        }
      />
      <DocumentViewer data={data} initialPage={initialPage} initialValue={initialValue} facts={facts} summaries={summaries} ctx={ctx} />
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FactsPanel
            target={doc.id}
            facts={ledger.forTarget(doc.id)}
            actor={ctx.actor}
            staff={ctx.staff}
            verificationTypes={ctx.verificationTypes}
            title="Evidence and review on this document"
          />
        </div>
      </div>
    </>
  );
}
