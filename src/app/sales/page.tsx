import type { Metadata } from "next";
import { FindingRow } from "@/components/checks/finding-row";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { LotsTable } from "@/components/sales/lots-table";
import { Badge, Card, Stat } from "@/components/ui";
import { runChecks } from "@/lib/checks/run";
import { getLedger } from "@/lib/facts/repo";
import { fmtLineValue, fmtMoney, fmtNumber } from "@/lib/format";
import { getPacket } from "@/lib/packet/load";
import { boxSummaries, lotRows } from "@/lib/packet/sales";
import { lineHref } from "@/lib/refs";

export const metadata: Metadata = { title: "Sales detail" };

export default async function SalesPage() {
  const { packet, index } = getPacket();
  const { ledger } = await getLedger();
  const version = index.latestVersion;
  const rows = lotRows(index, version);
  const boxes = boxSummaries(rows, index, version);
  const run = runChecks(packet, index);
  const related = run.findings.filter((f) => f.area === "investments");
  const docTitles = Object.fromEntries(packet.documents.map((d) => [d.id, d.title]));
  const st = rows.filter((r) => r.term === "short");
  const lt = rows.filter((r) => r.term === "long");
  const sum = (xs: typeof rows, k: "proceeds" | "gain") => xs.reduce((a, r) => a + (r[k] ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Sales detail"
        description={
          rows.length +
          " dispositions across " +
          new Set(rows.map((r) => r.docId).filter(Boolean)).size +
          " statements, exactly as Form 8949 carries them in " +
          version +
          ". The table scrolls; the totals reconcile every box to Schedule D."
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Lots" value={rows.length} hint={st.length + " short-term · " + lt.length + " long-term"} />
        <Stat label="Proceeds" value={fmtMoney(sum(rows, "proceeds"))} />
        <Stat label="Net short-term" value={fmtMoney(sum(st, "gain"))} tone={sum(st, "gain") < 0 ? "danger" : undefined} />
        <Stat label="Net long-term" value={fmtMoney(sum(lt, "gain"))} tone={sum(lt, "gain") < 0 ? "danger" : undefined} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Boxes to Schedule D" description="Each Form 8949 box re-added from its lots, against the engine's box total and the Schedule D line it feeds." className="xl:col-span-2" flush>
          <table className="tbl dense">
            <thead>
              <tr>
                <th>Box</th>
                <th className="num">Lots</th>
                <th className="num">Proceeds</th>
                <th className="num">Basis</th>
                <th className="num">Adj.</th>
                <th className="num">Gain re-added</th>
                <th className="num">Engine total</th>
                <th>Schedule D</th>
              </tr>
            </thead>
            <tbody>
              {boxes.map((b) => {
                const engine = typeof b.boxTotalLine?.value === "number" ? b.boxTotalLine.value : null;
                const agrees = engine !== null && Math.abs(engine - b.gain) <= 1;
                return (
                  <tr key={b.box}>
                    <td>
                      <span className="font-mono">{b.box}</span> <span className="text-muted">{b.term}</span>
                    </td>
                    <td className="num">{b.lots}</td>
                    <td className="num">{fmtNumber(b.proceeds)}</td>
                    <td className="num">{fmtNumber(b.basis)}</td>
                    <td className="num text-muted">{b.adjustment ? fmtNumber(b.adjustment) : "—"}</td>
                    <td className="num font-medium">{fmtNumber(b.gain)}</td>
                    <td className="num">
                      {b.boxTotalLine ? (
                        <span className="inline-flex items-center gap-1.5">
                          <RefLink refId={b.boxTotalLine.key} href={lineHref(b.boxTotalLine.key, version)}>
                            {fmtLineValue(b.boxTotalLine.value)}
                          </RefLink>
                          <Badge tone={agrees ? "ok" : "danger"} dot>
                            {agrees ? "agrees" : "differs"}
                          </Badge>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {b.scheduleDLine ? (
                        <span className="flex items-baseline gap-2">
                          <RefLink refId={b.scheduleDLine.key} href={lineHref(b.scheduleDLine.key, version)} />
                          <span className="num text-muted">{fmtLineValue(b.scheduleDLine.value)}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title="Investment checks" description="Findings from the checks that cover brokers, lots and digital assets." flush>
          {related.length ? (
            <ul className="divide-y divide-border">
              {related.map((f) => (
                <FindingRow key={f.id} f={f} summary={ledger.summary("check:" + f.id)} />
              ))}
            </ul>
          ) : (
            <p className="p-4 text-[13px] text-muted">Every investment check is clean.</p>
          )}
        </Card>
      </div>

      <Card className="mt-4" title="Every lot" description="Click a security to open its Form 8949 line, or the source to open the statement on that lot." flush>
        <LotsTable rows={rows} docTitles={docTitles} version={version} />
      </Card>
    </>
  );
}
