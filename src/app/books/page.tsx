import type { Metadata } from "next";
import { FindingRow } from "@/components/checks/finding-row";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Card, cn, Stat } from "@/components/ui";
import { runChecks } from "@/lib/checks/run";
import { getLedger } from "@/lib/facts/repo";
import { fmtMoney, fmtNumber } from "@/lib/format";
import { booksToTax } from "@/lib/packet/books";
import { getPacket } from "@/lib/packet/load";
import { documentHref, lineHref } from "@/lib/refs";

export const metadata: Metadata = { title: "Books to tax" };

export default async function BooksPage() {
  const { packet, index } = getPacket();
  const { ledger } = await getLedger();
  const version = index.latestVersion;
  const b = booksToTax(packet, index, version);
  const run = runChecks(packet, index);
  const related = run.findings.filter((f) => f.area === "business");
  const findingsFor = (keys: string[]) => related.filter((f) => f.refs.some((r) => keys.includes(r)));
  const books = b.rows.filter((r) => r.kind !== "tax-only");
  const taxOnly = b.rows.filter((r) => r.kind === "tax-only");

  return (
    <>
      <PageHeader
        eyebrow="Workpapers"
        title="Books to taxable income"
        description={
          "Lindqvist Studio's profit and loss" +
          (b.booksDoc ? " (" + b.booksDoc + ")" : "") +
          " line by line against Schedule C in " +
          version +
          ". Every difference is either a tax rule, a reclassification, or something that needs a reason."
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Books net income" value={b.booksNet !== null ? fmtMoney(b.booksNet) : "—"} hint={b.booksIncome !== null && b.booksExpenses !== null ? fmtMoney(b.booksIncome) + " income − " + fmtMoney(b.booksExpenses) + " expenses" : undefined} />
        <Stat label="Schedule C net profit" value={b.taxNet !== null ? fmtMoney(b.taxNet) : "—"} hint={b.taxGross !== null && b.taxExpenses !== null ? fmtMoney(b.taxGross) + " gross − " + fmtMoney(b.taxExpenses) + " expenses − " + fmtMoney(b.taxHomeOffice ?? 0) + " home office" : undefined} />
        <Stat
          label="Book to tax difference"
          value={b.booksNet !== null && b.taxNet !== null ? (b.taxNet - b.booksNet > 0 ? "+" : "−") + fmtMoney(Math.abs(b.taxNet - b.booksNet)) : "—"}
          hint="explained row by row below"
        />
        <Stat label="Business findings" value={related.filter((f) => f.severity === "error").length} tone={related.some((f) => f.severity === "error") ? "danger" : "ok"} hint={related.length + " total from the checks"} />
      </div>

      <Card className="mt-4" title="Line by line" description="Books on the left, the return on the right. Positive differences reduce taxable profit relative to the books; negative ones increase it." flush>
        <div className="overflow-auto">
          <table className="tbl dense">
            <thead>
              <tr>
                <th>Books account</th>
                <th className="num">Books</th>
                <th>Schedule C line</th>
                <th className="num">Return</th>
                <th className="num">Difference</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {[...books, ...taxOnly].map((r, i) => {
                const fs = findingsFor(r.taxLines.map((l) => l.key));
                return (
                  <tr key={i} className={cn(r.kind === "income" && "bg-surface-2/40 font-medium", fs.some((f) => f.severity === "error") && "bg-danger-soft/10")}>
                    <td className="min-w-[200px] pl-5">
                      <div>{r.label}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1 text-[11px]">
                        {r.bookValues.map((v) => (
                          <RefLink key={v.id} refId={v.id} href={documentHref(v.document_id, { page: v.page, value: v.id })} />
                        ))}
                      </div>
                    </td>
                    <td className="num">{r.books === null ? <span className="text-muted">—</span> : fmtNumber(r.books)}</td>
                    <td>
                      {r.taxLines.length ? (
                        r.taxLines.map((l) => (
                          <div key={l.key} className="flex items-baseline gap-2">
                            <RefLink refId={l.key} href={lineHref(l.key, version)} />
                            <span className="truncate text-muted">{l.label}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-muted">not on Schedule C</span>
                      )}
                    </td>
                    <td className="num">{r.tax === null ? <span className="text-muted">—</span> : fmtNumber(r.tax)}</td>
                    <td className="num">
                      {Math.abs(r.difference) <= 1 ? (
                        <span className="text-border-strong">—</span>
                      ) : (
                        <span className={cn("rounded-md px-1.5 font-mono text-[11.5px] font-medium leading-[18px] tabular-nums", (r.kind === "income" ? r.difference > 0 : r.difference < 0) ? "bg-warn-soft text-warn" : "bg-surface-2 text-foreground")}>{(r.difference > 0 ? "+" : "") + fmtNumber(r.difference)}</span>
                      )}
                    </td>
                    <td className="max-w-[340px]">
                      <div className="text-[12.5px] leading-5 text-muted">{r.note}</div>
                      {fs.length ? (
                        <div className="mt-1 grid gap-1">
                          {fs.map((f) => (
                            <RefLink key={f.id} refId={"check:" + f.id} plain className="flex items-start gap-1.5 text-[12px] hover:underline">
                              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", f.severity === "error" ? "bg-danger" : "bg-warn")} />
                              <span className="line-clamp-1">{f.title}</span>
                            </RefLink>
                          ))}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4" title="Business checks" description="Gross receipts against third-party reporting, mixed-use expenses, the mileage log and the self-employment limits." flush>
        {related.length ? (
          <ul className="divide-y divide-border">
            {related.map((f) => (
              <FindingRow key={f.id} f={f} summary={ledger.summary("check:" + f.id)} />
            ))}
          </ul>
        ) : (
          <p className="p-4 text-[13px] text-muted">Every business check is clean.</p>
        )}
      </Card>
    </>
  );
}
