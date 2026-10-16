import { RecordHeader } from "@/components/record/record-header";
import { displayValue, LOW_CONFIDENCE } from "@/components/record/value-record";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, Empty, KV, numClass, tableClass } from "@/components/ui";
import { fmtDateTime, fmtPct } from "@/lib/format";
import { maskText } from "@/lib/mask";
import type { PacketIndex } from "@/lib/packet/index";
import type { Resolved } from "@/lib/packet/resolve";

const statusTone = { extracted: "ok", partial: "warn", not_extracted: "warn" } as const;

export function DocumentRecord({
  resolved,
  index,
  reveal,
  literals,
}: {
  resolved: Extract<Resolved, { kind: "document" }>;
  index: PacketIndex;
  reveal: boolean;
  literals: string[];
}) {
  const { document, values, usage, page } = resolved;
  const latestReached = usage.linesReached.filter((l) => l.version === index.latestVersion);
  const sortedValues = [...values].sort((a, b) => a.page - b.page || a.id.localeCompare(b.id));

  return (
    <div className="grid gap-6">
      <RecordHeader kind="Document" id={document.id} title={document.title} subtitle={document.issuer + " · " + document.document_type}>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge tone={statusTone[document.extraction.status]}>{document.extraction.status.replace("_", " ")}</Badge>
          {document.marked_corrected ? <Badge tone="warn">marked CORRECTED by issuer</Badge> : null}
          {usage.supersededIn.length ? <Badge tone="warn">superseded in {usage.supersededIn.join(", ")}</Badge> : null}
        </div>
      </RecordHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="About this document">
          <KV
            rows={[
              ["Belongs to", document.belongs_to],
              ["Tax year", String(document.tax_year)],
              ["Received", fmtDateTime(document.received_at) + " from " + document.uploaded_by],
              ["File", <span key="f" className="font-mono text-xs">{document.file_name}</span>],
              ["Pages", String(document.page_count)],
              ["Extraction", document.extraction.values + " values" + (document.extraction.reason ? ". " + document.extraction.reason : "")],
            ]}
          />
        </Card>

        <Card title="Where it landed">
          <KV
            rows={[
              ["Used in", usage.usedIn.length ? usage.usedIn.join(", ") : "no version lists it as used"],
              ["Superseded in", usage.supersededIn.length ? usage.supersededIn.join(", ") : "never"],
              [
                "Lines reached in " + index.latestVersion,
                latestReached.length ? (
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {latestReached.map((l) => (
                      <RefLink key={l.key} refId={l.key} />
                    ))}
                  </span>
                ) : (
                  <span className="text-muted">none</span>
                ),
              ],
            ]}
          />
        </Card>
      </div>

      <Card title={"Extracted values (" + values.length + ")"}>
        {values.length === 0 ? (
          <Empty>The pipeline extracted nothing from this document.</Empty>
        ) : (
          <div className="max-h-[32rem] overflow-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>Id</th>
                  <th className={numClass}>Page</th>
                  <th>Field</th>
                  <th>Label</th>
                  <th className={numClass}>Value</th>
                  <th className={numClass}>Confidence</th>
                  <th>Lands on ({index.latestVersion})</th>
                </tr>
              </thead>
              <tbody>
                {sortedValues.map((v) => {
                  const lines = (index.linesByValue.get(v.id) ?? []).filter((l) => l.version === index.latestVersion);
                  return (
                    <tr key={v.id}>
                      <td>
                        <RefLink refId={v.id} />
                      </td>
                      <td className={numClass}>{v.page}</td>
                      <td className="font-mono text-xs">{v.field}</td>
                      <td>{v.label}</td>
                      <td className={numClass + " font-mono"}>{displayValue(v, reveal)}</td>
                      <td className={numClass}>
                        {v.confidence < LOW_CONFIDENCE ? <Badge tone="warn">{fmtPct(v.confidence)}</Badge> : fmtPct(v.confidence)}
                      </td>
                      <td className="space-x-2">
                        {lines.length ? lines.map((l) => <RefLink key={l.key} refId={l.key} />) : <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={"Printed pages (" + document.pages.length + ")"}>
        <p className="mb-3 text-xs text-muted">
          Simulated from the packet&apos;s page text. A real page image slots in here without changing any link.
          {reveal ? "" : " Sensitive numbers are masked for your role."}
        </p>
        <div className="grid gap-3">
          {document.pages.map((p) => (
            <details key={p.page} open={page ? p.page === page : p.page === 1}>
              <summary className="cursor-pointer text-sm font-medium">Page {p.page}</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded border border-border bg-background p-3 font-mono text-xs leading-5">
                {reveal ? p.printed_content : maskText(p.printed_content, literals)}
              </pre>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
