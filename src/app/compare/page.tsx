import { ArrowLeftRight, ArrowRight, GitCompare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, cn, Empty, Stat } from "@/components/ui";
import { effectiveReturn } from "@/lib/effective";
import { getLedger } from "@/lib/facts/repo";
import { formLabel, formShort, sortForms } from "@/lib/forms";
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
      const delta = numeric ? (vb as number) - (va as number) : null;
      const pct = numeric && (va as number) !== 0 && delta !== null ? delta / Math.abs(va as number) : null;
      return { key, form: key.split(".")[0], va, vb, changed, delta, pct };
    })
    .filter((r) => showAll || r.changed);
  const byForm = new Map<string, typeof rows>();
  for (const r of rows) byForm.set(r.form, [...(byForm.get(r.form) ?? []), r]);
  const forms = sortForms([...byForm.keys()].map((form) => ({ form }))).map((f) => f.form);

  const summaryOf = (id: string) => (id === "working" ? eff.workingSummary : { federal: index.versions.get(id)!.summary.federal, california: index.versions.get(id)!.summary.california });
  const sa = summaryOf(a);
  const sb = summaryOf(b);
  const name = (id: string) => (id === "working" ? "Working" : id);
  const describe = (id: string) => (id === "working" ? index.latestVersion + " + " + eff.adjustments.length + " adjustment" + (eff.adjustments.length === 1 ? "" : "s") : fmtDate(index.versions.get(id)!.computed_at) + " · " + index.versions.get(id)!.trigger);
  const link = (na: string, nb: string, nall = showAll) => "/compare?a=" + na + "&b=" + nb + (nall ? "&all=1" : "");
  const changedCount = rows.filter((r) => r.changed).length;
  const up = rows.filter((r) => (r.delta ?? 0) > 0).length;
  const down = rows.filter((r) => (r.delta ?? 0) < 0).length;

  return (
    <>
      <PageHeader
        eyebrow="Review"
        title="Compare versions"
        description="Any two states of the return side by side: the three engine runs and the working return with adjustments applied. Only lines that differ are shown unless you ask for everything."
        meta={
          <>
            <Badge tone="accent" dot>
              {changedCount} line{changedCount === 1 ? "" : "s"} differ
            </Badge>
            <Badge tone="neutral">
              {up} up · {down} down
            </Badge>
            <Link href={link(a, b, !showAll)} className={cn("chip h-6", showAll && "is-active")}>
              {showAll ? "Showing every line" : "Show every line"}
            </Link>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Picker current={a} options={options} href={(x) => link(x, b)} label="From" latest={index.latestVersion} />
            <Link href={link(b, a)} className="icon-btn" title="Swap sides" aria-label="Swap sides">
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </Link>
            <Picker current={b} options={options} href={(x) => link(a, x)} label="To" latest={index.latestVersion} />
          </div>
        }
      />

      <div className="card mb-4 grid gap-0 divide-y divide-border sm:grid-cols-[1fr_auto_1fr] sm:divide-x sm:divide-y-0">
        <div className="min-w-0 px-5 py-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">From</div>
          <div className="mt-0.5 text-[15px] font-semibold">{name(a)}</div>
          <div className="truncate text-[12px] text-muted">{describe(a)}</div>
        </div>
        <div className="flex items-center justify-center px-4 text-muted">
          <ArrowRight className="h-4 w-4" />
        </div>
        <div className="min-w-0 px-5 py-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-accent">To</div>
          <div className="mt-0.5 text-[15px] font-semibold">{name(b)}</div>
          <div className="truncate text-[12px] text-muted">{describe(b)}</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Federal total tax" value={fmtMoney(sb.federal.total_tax)} delta={deltaText(sa.federal.total_tax, sb.federal.total_tax)} hint={"from " + fmtMoney(sa.federal.total_tax)} />
        <Stat label="Federal balance" value={fmtBalance(sb.federal.balance_due)} delta={deltaText(sa.federal.balance_due, sb.federal.balance_due)} hint={"from " + fmtBalance(sa.federal.balance_due)} />
        <Stat label="California total tax" value={fmtMoney(sb.california.total_tax)} delta={deltaText(sa.california.total_tax, sb.california.total_tax)} hint={"from " + fmtMoney(sa.california.total_tax)} />
        <Stat label="California balance" value={fmtBalance(sb.california.balance_due)} delta={deltaText(sa.california.balance_due, sb.california.balance_due)} hint={"from " + fmtBalance(sa.california.balance_due)} />
      </div>

      {forms.length > 1 ? (
        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Forms</span>
          {forms.map((form) => (
            <a key={form} href={"#" + form} className="chip h-7">
              {formShort(form)}
              <span className="count">{byForm.get(form)!.length}</span>
            </a>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4">
        {forms.length === 0 ? (
          <Empty>
            <GitCompare className="mx-auto mb-1 h-4 w-4" />
            Nothing differs between {name(a)} and {name(b)}.
          </Empty>
        ) : null}
        {forms.map((form) => (
          <Card key={form} id={form} className="scroll-mt-24" title={formLabel(form)} aside={<Badge tone="neutral">{byForm.get(form)!.length + " line" + (byForm.get(form)!.length === 1 ? "" : "s")}</Badge>} flush>
            <table className="tbl dense">
              <thead>
                <tr>
                  <th className="w-36">Line</th>
                  <th>Label</th>
                  <th className="num">{name(a)}</th>
                  <th className="num">{name(b)}</th>
                  <th className="num">Change</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {byForm.get(form)!.map((r) => {
                  const w = b === "working" ? eff.lines.get(r.key) : undefined;
                  const change = b !== "working" ? index.versions.get(b)?.changes_from_previous.find((c) => c.key === r.key) : undefined;
                  return (
                    <tr key={r.key} className={cn(!r.changed && "text-muted")}>
                      <td className="pl-5">
                        <RefLink refId={r.key} href={lineHref(r.key, b === "working" ? index.latestVersion : b)} />
                      </td>
                      <td className="max-w-xl truncate">{labelFor(r.key)}</td>
                      <td className="num text-muted">{r.va === undefined ? <span className="italic">absent</span> : fmtLineValue(r.va)}</td>
                      <td className="num font-semibold">{r.vb === undefined ? <span className="italic font-normal text-muted">absent</span> : fmtLineValue(r.vb)}</td>
                      <td className="num">
                        {r.delta ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn("font-medium", r.delta > 0 ? "text-warn" : "text-ok")}>{(r.delta > 0 ? "+" : "") + fmtLineValue(Math.round(r.delta * 100) / 100)}</span>
                            {r.pct !== null && Math.abs(r.pct) < 100 ? <span className="rounded-md bg-surface-2 px-1 font-mono text-[10.5px] leading-4 text-muted">{(r.pct > 0 ? "+" : "") + Math.round(r.pct * 100) + "%"}</span> : null}
                          </span>
                        ) : (
                          <span className="text-border-strong">—</span>
                        )}
                      </td>
                      <td className="max-w-md text-[12px] text-muted">
                        {w ? (
                          w.kind === "adjusted" ? (
                            <span className="flex items-center gap-1.5">
                              <Badge tone="accent">adjusted</Badge>
                              <span className="truncate">{w.adjustments[w.adjustments.length - 1].reason}</span>
                            </span>
                          ) : w.kind === "derived" ? (
                            <span className="flex items-center gap-1.5">
                              <Badge tone="neutral">derived</Badge> recomputed from adjusted inputs
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <Badge tone="warn">engine-owned</Badge> inputs changed; needs a rerun
                            </span>
                          )
                        ) : change ? (
                          <span className="flex items-center gap-1.5">
                            <Badge tone="neutral">{change.change}</Badge> in {b}
                          </span>
                        ) : r.va === undefined || r.vb === undefined ? (
                          "present in one version only"
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

function Picker({ current, options, href, label, latest }: { current: string; options: string[]; href: (x: string) => string; label: string; latest: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</span>
      <span className="seg">
        {options.map((o) => (
          <Link key={o} href={href(o)} className={cn("seg-item", o === current && "is-active")}>
            {o === "working" ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
            {o === "working" ? "Working" : o}
            {o === latest ? <span className="rounded-full bg-ok-soft px-1 text-[9.5px] font-semibold leading-3.5 text-ok">current</span> : null}
          </Link>
        ))}
      </span>
    </span>
  );
}
