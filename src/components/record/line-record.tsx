import { RecordHeader } from "@/components/record/record-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, Empty, KV, numClass, tableClass } from "@/components/ui";
import { fmtExtractedValue, fmtLineValue } from "@/lib/format";
import type { PacketIndex } from "@/lib/packet/index";
import type { Resolved } from "@/lib/packet/resolve";
import type { Packet } from "@/lib/packet/schema";
import { parseRef } from "@/lib/refs";

export function LineRecord({
  resolved,
  packet,
  index,
}: {
  resolved: Extract<Resolved, { kind: "line" }>;
  packet: Packet;
  index: PacketIndex;
}) {
  const { key, byVersion, priorYear } = resolved;
  const present = byVersion.filter((b) => b.line);
  const latest = present.length ? present[present.length - 1] : null;
  const line = latest?.line ?? null;
  const latestVersion = latest?.version ?? index.latestVersion;
  const lineMap = index.lines.get(latestVersion);
  const dependents = index.dependents.get(latestVersion)?.get(key) ?? [];

  return (
    <div className="grid gap-6">
      <RecordHeader
        kind="Return line"
        id={key}
        title={line?.label ?? priorYear?.label ?? key}
        subtitle={line ? line.jurisdiction + " · " + line.form + " line " + line.line : "Only present on the 2024 return"}
      >
        {line ? <div className="mt-1 text-2xl font-semibold tabular-nums">{fmtLineValue(line.value)}</div> : null}
      </RecordHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Across versions">
          <table className={tableClass}>
            <thead>
              <tr>
                <th>Version</th>
                <th className={numClass}>Value</th>
                <th>Rule</th>
              </tr>
            </thead>
            <tbody>
              {priorYear ? (
                <tr className="text-muted">
                  <td>2024 as filed</td>
                  <td className={numClass}>{fmtLineValue(priorYear.value)}</td>
                  <td>{priorYear.source ? <RefLink refId={priorYear.source} /> : "prior return"}</td>
                </tr>
              ) : null}
              {byVersion.map((b) => (
                <tr key={b.version}>
                  <td>{b.version}</td>
                  <td className={numClass}>{b.line ? fmtLineValue(b.line.value) : <span className="text-muted">not present</span>}</td>
                  <td className="font-mono text-xs">{b.line?.rule ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {line ? (
            <div className="mt-3 border-t border-border pt-3">
              <KV
                rows={[
                  ["Rule " + line.rule, packet.engine_reference.rules[line.rule] ?? <span className="text-muted">not described in engine_reference</span>],
                  ...(line.note ? ([["Engine note", line.note]] as [string, string][]) : []),
                ]}
              />
            </div>
          ) : null}
        </Card>

        <Card title={"Built from (" + latestVersion + ")"}>
          {line && line.inputs.length ? (
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>Input line</th>
                  <th>Label</th>
                  <th className={numClass}>Value</th>
                </tr>
              </thead>
              <tbody>
                {line.inputs.map((k) => {
                  const inp = lineMap?.get(k);
                  return (
                    <tr key={k}>
                      <td>
                        <RefLink refId={k} />
                      </td>
                      <td>{inp?.label ?? <span className="text-warn">missing</span>}</td>
                      <td className={numClass}>{inp ? fmtLineValue(inp.value) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Empty>No input lines. This line comes straight from sources.</Empty>
          )}

          <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Sources</h3>
          {line && line.sources.length ? (
            <ul className="grid gap-1 text-sm">
              {line.sources.map((s) => {
                const ref = parseRef(s);
                if (ref.kind === "value") {
                  const v = index.values.get(ref.id);
                  const d = v ? index.documents.get(v.document_id) : undefined;
                  return (
                    <li key={s} className="flex flex-wrap items-baseline gap-x-2">
                      <RefLink refId={s} />
                      {v ? (
                        <>
                          <span className="tabular-nums">{fmtExtractedValue(v.value)}</span>
                          <span className="text-muted">
                            {v.label} · {d ? d.title : v.document_id} p.{v.page}
                          </span>
                        </>
                      ) : (
                        <Badge tone="warn">missing value</Badge>
                      )}
                    </li>
                  );
                }
                return (
                  <li key={s}>
                    <RefLink refId={s} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>No direct sources.</Empty>
          )}
        </Card>
      </div>

      <Card title={"Feeds into (" + latestVersion + ")"}>
        {dependents.length === 0 ? (
          <Empty>No other line uses this one as an input.</Empty>
        ) : (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {dependents.map((k) => (
              <li key={k}>
                <RefLink refId={k} /> <span className="text-muted">{lineMap?.get(k)?.label}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
