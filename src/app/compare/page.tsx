import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, cn, Stat } from "@/components/ui";
import { effectiveReturn } from "@/lib/effective";
import { getLedger } from "@/lib/facts/repo";
import { formLabel, sortForms } from "@/lib/forms";
import { fmtBalance, fmtDate, fmtLineValue, fmtMoney } from "@/lib/format";
import { getPacket } from "@/lib/packet/load";
import { lineHref } from "@/lib/refs";

export const metadata: Metadata = { title: "Compare versions" };

type Props = { searchParams: Promise<{ a?: string; b?: string; all?: string }> };

export default async function ComparePage({ searchParams }: Props) {
  const { a: qa, b: qb, all } = await searchParams;
  const { packet, index } = getPacket();
  const { ledger } = await getLedger();
  const eff = effectiveReturn(packet, index, ledger);
  const options = [...index.versionOrder, "working"];
  const prev = index.versionOrder[index.versionOrder.length - 2] ?? index.versionOrder[0];
  const a = qa && options.includes(qa) ? qa : prev;
  const b = qb && options.includes(qb) ? qb : eff.adjustments.length ? "working" : index.latestVersion;
  const showAll = all === "1";

  const valueIn = (id: string, key: string) => (id === "working" ? eff.value(key) : index.lines.get(id)?.get(key)?.value);
  const labelFor = (key: string) => index.lines.get(index.latestVersion)?.get(key)?.label ?? [...index.lines.values()].map((m) => m.get(key)?.label).find(Boolean) ?? key;
  const keys = new Set<string>();
  for (const id of [a, b]) for (const k of (index.lines.get(id === "working" ? index.latestVersion : id) ?? new Map()).keys()) keys.add(k);

  const rows = [...keys]
    .map((key) => {
      const va = valueIn(a, key);
      const vb = valueIn(b, key);
      const numeric = typeof va === "number" && typeof vb === "number";
      const changed = va === undefined || vb === undefined ? true : numeric ? Math.abs((va as number) - (vb as number)) > 0.004 : va !== vb;
      return { key, form: key.split(".")[0], va, vb, changed, delta: numeric ? (vb as number) - (va as number) : null };
    })
    .filter((r) => showAll || r.changed);
  const byForm = new Map<string, typeof rows>();
  for (const r of rows) byForm.set(r.form, [...(byForm.get(r.form) ?? []), r]);
  const forms = sortForms([...byForm.keys()].map((form) => ({ form }))).map((f) => f.form);

  const summaryOf = (id: string) => (id === "working" ? eff.workingSummary : { federal: index.versions.get(id)!.summary.federal, california: index.versions.get(id)!.summary.california });
  const sa = summaryOf(a);
  const sb = summaryOf(b);
  const describe = (id: string) => (id === "working" ? "Working: " + index.latestVersion + " + " + eff.adjustments.length + " adjustments" : id + " · " + fmtDate(index.versions.get(id)!.computed_at));
  const link = (na: string, nb: string, nall = showAll) => "/compare?a=" + na + "&b=" + nb + (nall ? "&all=1" : "");
  const changedCount = rows.filter((r) => r.changed).length;

  return (
    <>
      <PageHeader
        title="Compare versions"
        description="Any two states of the return side by side: the three engine runs and the working return with adjustments applied. Only lines that differ are shown unless you ask for everything."
        meta={
          <>
            <Badge tone="accent" dot>
              {changedCount} line{changedCount === 1 ? "" : "s"} differ
            </Badge>
            <Link href={link(a, b, !showAll)} className="text-[12px] text-accent hover:underline">
              {showAll ? "Show only changes" : "Show every line"}
            </Link>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <Picker current={a} options={options} href={(x) => link(x, b)} label="From" />
            <span className="text-muted">→</span>
            <Picker current={b} options={options} href={(x) => link(a, x)} label="To" />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Federal total tax" value={fmtMoney(sb.federal.total_tax)} delta={deltaText(sa.federal.total_tax, sb.federal.total_tax)} hint={describe(a) + " → " + describe(b)} />
        <Stat label="Federal balance due" value={fmtBalance(sb.federal.balance_due)} delta={deltaText(sa.federal.balance_due, sb.federal.balance_due)} />
        <Stat label="California total tax" value={fmtMoney(sb.california.total_tax)} delta={deltaText(sa.california.total_tax, sb.california.total_tax)} />
        <Stat label="California balance" value={fmtBalance(sb.california.balance_due)} delta={deltaText(sa.california.balance_due, sb.california.balance_due)} />
      </div>

      <div className="mt-4 grid gap-4">
        {forms.length === 0 ? (
          <Card>
            <p className="text-[13px] text-muted">Nothing differs between {describe(a)} and {describe(b)}.</p>
          </Card>
        ) : null}
        {forms.map((form) => (
          <Card key={form} title={formLabel(form)} aside={byForm.get(form)!.length + " line" + (byForm.get(form)!.length === 1 ? "" : "s")} flush>
            <table className="tbl dense">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Label</th>
                  <th className="num">{a === "working" ? "Working" : a}</th>
                  <th className="num">{b === "working" ? "Working" : b}</th>
                  <th className="num">Δ</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {byForm.get(form)!.map((r) => {
                  const w = b === "working" ? eff.lines.get(r.key) : undefined;
                  const change = b !== "working" ? index.versions.get(b)?.changes_from_previous.find((c) => c.key === r.key) : undefined;
                  return (
                    <tr key={r.key} className={cn(!r.changed && "text-muted")}>
                      <td>
                        <RefLink refId={r.key} href={lineHref(r.key, b === "working" ? index.latestVersion : b)} />
                      </td>
                      <td className="max-w-xl truncate">{labelFor(r.key)}</td>
                      <td className="num">{r.va === undefined ? <span className="text-muted">absent</span> : fmtLineValue(r.va)}</td>
                      <td className="num font-medium">{r.vb === undefined ? <span className="text-muted">absent</span> : fmtLineValue(r.vb)}</td>
                      <td className={cn("num", r.delta ? (r.delta > 0 ? "text-warn" : "text-ok") : "text-muted")}>{r.delta ? (r.delta > 0 ? "+" : "") + fmtLineValue(Math.round(r.delta * 100) / 100) : "—"}</td>
                      <td className="max-w-md text-[12px] text-muted">
                        {w ? (
                          w.kind === "adjusted" ? (
                            <span>
                              <Badge tone="accent">adjusted</Badge> {w.adjustments[w.adjustments.length - 1].reason}
                            </span>
                          ) : w.kind === "derived" ? (
                            "Recomputed from adjusted inputs"
                          ) : (
                            "Inputs changed; engine-owned computation"
                          )
                        ) : change ? (
                          change.change + " in " + b
                        ) : r.va === undefined || r.vb === undefined ? (
                          "Line present in one version only"
                        ) : (
                          ""
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
    </>
  );
}

function deltaText(from: number, to: number): { text: string; tone: "ok" | "warn" | "neutral" } {
  const d = to - from;
  if (d === 0) return { text: "unchanged", tone: "neutral" };
  return { text: (d > 0 ? "+" : "−") + fmtMoney(Math.abs(d)), tone: d > 0 ? "warn" : "ok" };
}

function Picker({ current, options, href, label }: { current: string; options: string[]; href: (x: string) => string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-muted">{label}</span>
      <span className="inline-flex rounded-full border border-border bg-surface p-0.5">
        {options.map((o) => (
          <Link key={o} href={href(o)} className={cn("rounded-full px-2.5 py-1 font-medium", o === current ? "bg-accent text-accent-fg" : "text-muted hover:text-foreground")}>
            {o === "working" ? "Working" : o}
          </Link>
        ))}
      </span>
    </span>
  );
}
