import { RecordHeader } from "@/components/record/record-header";
import { Card } from "@/components/ui";
import { redactDeep } from "@/lib/mask";
import type { Resolved } from "@/lib/packet/resolve";

export function GenericRecord({
  resolved,
  refStr,
  literals,
}: {
  resolved: Extract<Resolved, { kind: "generic" }>;
  refStr: string;
  literals: string[];
}) {
  const data = literals.length ? redactDeep(resolved.data, literals) : resolved.data;
  return (
    <div className="grid gap-6">
      <RecordHeader kind="Packet record" id={refStr} title={resolved.title} subtitle={resolved.subtitle} />
      <Card title="As delivered">
        <pre className="overflow-auto whitespace-pre-wrap rounded border border-border bg-background p-3 font-mono text-xs leading-5">
          {JSON.stringify(data, null, 2)}
        </pre>
      </Card>
    </div>
  );
}
