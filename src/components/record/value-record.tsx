import { RecordHeader } from "@/components/record/record-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, Empty, KV } from "@/components/ui";
import { fmtExtractedValue, fmtPct } from "@/lib/format";
import { maskAccount, maskSsn } from "@/lib/mask";
import type { PacketIndex } from "@/lib/packet/index";
import type { Resolved } from "@/lib/packet/resolve";
import type { ExtractedValue } from "@/lib/packet/schema";

export const LOW_CONFIDENCE = 0.8;

export function displayValue(v: ExtractedValue, reveal: boolean): string {
  const text = fmtExtractedValue(v.value);
  if (reveal || v.value === null) return text;
  if (v.value_type === "ssn") return maskSsn(String(v.value));
  if (v.value_type === "account_number") return maskAccount(String(v.value));
  return text;
}

export function ValueRecord({
  resolved,
  index,
  reveal,
}: {
  resolved: Extract<Resolved, { kind: "value" }>;
  index: PacketIndex;
  reveal: boolean;
}) {
  const { value, document, landsOn } = resolved;
  const shown = displayValue(value, reveal);
  const asRead = reveal || !["ssn", "account_number"].includes(value.value_type) ? value.text_as_read : shown;
  const byVersion = new Map<string, string[]>();
  for (const l of landsOn) byVersion.set(l.version, [...(byVersion.get(l.version) ?? []), l.key]);

  return (
    <div className="grid gap-6">
      <RecordHeader kind="Extracted value" id={value.id} title={value.label} subtitle={value.field}>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-2xl font-semibold tabular-nums">{shown}</span>
          <Badge tone={value.confidence < LOW_CONFIDENCE ? "warn" : "ok"}>confidence {fmtPct(value.confidence)}</Badge>
          <Badge>{value.value_type}</Badge>
        </div>
      </RecordHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Where it was read">
          <KV
            rows={[
              ["Document", document ? <RefLink refId={document.id}>{document.id} · {document.title}</RefLink> : value.document_id + " (missing)"],
              ["Page", String(value.page)],
              ["Field", value.field],
              ["Text as read", asRead === "" ? <span className="text-muted">(nothing printed)</span> : <span className="font-mono">{asRead}</span>],
              [
                "Position",
                "x " + value.position.x0.toFixed(3) + " to " + value.position.x1.toFixed(3) + ", y " + value.position.y0.toFixed(3) + " to " + value.position.y1.toFixed(3),
              ],
            ]}
          />
        </Card>

        <Card title="Where it landed on the return">
          {landsOn.length === 0 ? (
            <Empty>No return line cites this value in any version.</Empty>
          ) : (
            <ul className="grid gap-2 text-sm">
              {index.versionOrder.map((v) => {
                const keys = byVersion.get(v);
                if (!keys) return null;
                return (
                  <li key={v}>
                    <span className="text-muted">{v}:</span>{" "}
                    {keys.map((k) => {
                      const line = index.lines.get(v)?.get(k);
                      return (
                        <span key={k} className="mr-3 inline-block">
                          <RefLink refId={k} />
                          {line ? <span className="text-muted"> {line.label}</span> : null}
                        </span>
                      );
                    })}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
