import { Braces, Building2, CalendarClock, ClipboardList, Landmark, MessageSquare, Package, Phone, ScrollText, Search, SlidersHorizontal, User, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Marks } from "@/components/facts/fact-marks";
import { FactsPanel } from "@/components/facts/facts-panel";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, cn, Empty, Pill } from "@/components/ui";
import { factsContext } from "@/lib/facts/context";
import { getLedger } from "@/lib/facts/repo";
import { formShort } from "@/lib/forms";
import { fmtDate, fmtDateTime, fmtLineValue, fmtNumber } from "@/lib/format";
import { redactDeep, sensitiveLiterals } from "@/lib/mask";
import { getPacket } from "@/lib/packet/load";
import { resolveRef } from "@/lib/packet/resolve";
import { hrefFor, lineHref, parseRef, type RefKind } from "@/lib/refs";
import { logSensitiveView } from "@/lib/sensitive";
import { getViewer } from "@/lib/session";

type Params = Promise<{ ref: string }>;

function decode(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ref } = await params;
  return { title: decode(ref) ?? ref };
}

/** What each reference kind is, in the words of the sidebar, with where its list lives. */
const KIND: Partial<Record<RefKind, { label: string; icon: ReactNode; list?: { href: string; label: string }; hint: string }>> = {
  version: { label: "Return version", icon: <ScrollText className="h-4 w-4" />, list: { href: "/return", label: "Return" }, hint: "A full computation of the return by the engine. Its lines have their own records; this is everything else about the run." },
  questionnaire: { label: "Questionnaire answer", icon: <ClipboardList className="h-4 w-4" />, list: { href: "/questions", label: "Questions" }, hint: "What the client told us in the organizer. Lines that rely on it cite it as a source." },
  message: { label: "Client message", icon: <MessageSquare className="h-4 w-4" />, list: { href: "/timeline", label: "Timeline" }, hint: "A message exchanged through the portal, kept verbatim." },
  call: { label: "Call notes", icon: <Phone className="h-4 w-4" />, list: { href: "/timeline", label: "Timeline" }, hint: "Notes taken on a call with the client. Each point is the preparer's record, not the client's words." },
  staff: { label: "Firm staff", icon: <User className="h-4 w-4" />, list: { href: "/standards", label: "Standards" }, hint: "A member of the firm who can act on this file. Their role decides what they may do." },
  client_user: { label: "Client user", icon: <User className="h-4 w-4" />, list: { href: "/client-copy", label: "Client copy" }, hint: "A client login on the portal. Clients see their own copy of the file and nothing internal." },
  person: { label: "Household member", icon: <Users className="h-4 w-4" />, list: { href: "/client-copy", label: "Client copy" }, hint: "Someone on the return. Identity fields stay masked unless the file is in reveal, and every reveal is logged." },
  asset: { label: "Depreciable asset", icon: <Package className="h-4 w-4" />, list: { href: "/assets", label: "Depreciation" }, hint: "An asset on the depreciation schedule, with this year's federal and California figures." },
  timeline: { label: "Timeline event", icon: <CalendarClock className="h-4 w-4" />, list: { href: "/timeline", label: "Timeline" }, hint: "Something that happened to the engagement, as the packet recorded it." },
  notice: { label: "Agency notice", icon: <Landmark className="h-4 w-4" />, list: { href: "/notices", label: "Notices" }, hint: "A letter from a tax agency about a prior year, and how it was resolved." },
  prior_year: { label: "Prior-year record", icon: <Braces className="h-4 w-4" />, list: { href: "/next-year", label: "Next year" }, hint: "Carried in from the 2024 return and the prior preparer's workpaper. The return cites these for carryovers and basis." },
  agency: { label: "Tax agency record", icon: <Landmark className="h-4 w-4" />, list: { href: "/filing", label: "Filing" }, hint: "What the IRS or FTB has on file: transcripts, account balances, e-file history." },
  engine_param: { label: "Engine parameter", icon: <SlidersHorizontal className="h-4 w-4" />, list: { href: "/standards", label: "Standards" }, hint: "A constant the computation engine used for this tax year, such as a threshold, rate or bracket." },
};

const DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function humanKey(k: string): string {
  return k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** A string that is one of the packet's references, and nothing else. */
function isRefString(s: string): boolean {
  if (s.length > 48 || /\s/.test(s)) return false;
  return parseRef(s).kind !== "unknown";
}

function Leaf({ v, k }: { v: unknown; k?: string }) {
  if (v === null || v === undefined) return <span className="text-border-strong">—</span>;
  if (typeof v === "boolean") return <Badge tone={v ? "ok" : "neutral"}>{v ? "Yes" : "No"}</Badge>;
  if (typeof v === "number") return <span className="font-mono text-[12.5px] tabular-nums">{Number.isInteger(v) ? fmtNumber(v) : v.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span>;
  if (typeof v === "string") {
    if (DATE.test(v)) {
      return <span title={v}>{v.length > 10 ? fmtDateTime(v) : fmtDate(v)}</span>;
    }
    if (isRefString(v) && k !== "id" && k !== "asset_id") return <RefLink refId={v} />;
    if (v.length > 120) return <p className="max-w-prose whitespace-pre-wrap text-[12.5px] leading-5">{v}</p>;
    return <span className={cn(/^[a-z0-9_]+$/.test(v) && k !== "name" ? "font-mono text-[12px]" : "")}>{v}</span>;
  }
  return <span className="font-mono text-[11.5px]">{JSON.stringify(v)}</span>;
}

/** Any packet record, rendered as nested key/value rows instead of JSON. */
function DataView({ data, depth = 0 }: { data: unknown; depth?: number }): ReactNode {
  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-border-strong">none</span>;
    const scalars = data.every((x) => x === null || typeof x !== "object");
    if (scalars) {
      const refs = data.every((x) => typeof x === "string" && isRefString(x));
      return refs ? (
        <span className="flex flex-wrap gap-1">
          {data.map((x, i) => (
            <RefLink key={i} refId={String(x)} />
          ))}
        </span>
      ) : (
        <ol className={cn("grid gap-1.5", data.length > 1 && "list-decimal pl-5 marker:font-mono marker:text-[11px] marker:text-muted")}>
          {data.map((x, i) => (
            <li key={i} className="text-[12.5px] leading-5">
              <Leaf v={x} />
            </li>
          ))}
        </ol>
      );
    }
    return (
      <div className="grid gap-2">
        {data.map((x, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface-2/30 p-3">
            <DataView data={x} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  if (data && typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-border-strong">empty</span>;
    return (
      <dl className={cn("grid gap-x-6 gap-y-2 text-[13px]", depth === 0 ? "grid-cols-[minmax(140px,max-content)_1fr]" : "grid-cols-[minmax(120px,max-content)_1fr] text-[12.5px]")}>
        {entries.map(([k, v]) => {
          const nested = v && typeof v === "object" && !(Array.isArray(v) && v.every((x) => x === null || typeof x !== "object"));
          return nested ? (
            <div key={k} className="col-span-2 mt-1 grid gap-1.5">
              <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                {humanKey(k)}
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className={cn(depth === 0 && "rounded-lg border border-border bg-surface-2/30 p-3")}>
                <DataView data={v} depth={depth + 1} />
              </div>
            </div>
          ) : (
            <div key={k} className="contents">
              <dt className="text-muted">{humanKey(k)}</dt>
              <dd className="min-w-0 break-words">{Array.isArray(v) ? <DataView data={v} depth={depth + 1} /> : <Leaf v={v} k={k} />}</dd>
            </div>
          );
        })}
      </dl>
    );
  }
  return <Leaf v={data} />;
}

/** The path segments of a pointer reference, each linking to its parent record. */
function PointerTrail({ prefix, pointer }: { prefix: string; pointer: string }) {
  const parts = pointer.split("/").filter(Boolean);
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="font-mono">{prefix}</span>
      {parts.map((p, i) => {
        const href = "/r/" + encodeURIComponent(prefix + ":/" + parts.slice(0, i + 1).join("/"));
        const last = i === parts.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            <span className="text-border-strong">/</span>
            {last ? (
              <span className="font-mono text-foreground">{p}</span>
            ) : (
              <Link href={href} className="font-mono hover:text-accent hover:underline">
                {p}
              </Link>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** Fallback record view for reference kinds that do not have a dedicated screen. */
export default async function RecordPage({ params }: { params: Params }) {
  const { ref: raw } = await params;
  const refStr = decode(raw);
  if (!refStr) notFound();

  const parsed = parseRef(refStr);
  // Kinds with a screen of their own go there; everything else is shown here.
  if (parsed.kind === "value" || parsed.kind === "document" || parsed.kind === "line" || parsed.kind === "check") redirect(hrefFor(refStr));

  const { packet, index } = getPacket();
  const resolved = resolveRef(parsed, packet, index);
  if (!resolved || resolved.kind !== "generic") notFound();

  const [{ actor, reveal }, { ledger }, ctx] = await Promise.all([getViewer(), getLedger(), factsContext()]);
  const redacted = redactDeep(resolved.data, sensitiveLiterals(packet));
  const hasSensitive = JSON.stringify(redacted) !== JSON.stringify(resolved.data);
  const data = reveal ? resolved.data : redacted;
  if (reveal && hasSensitive) logSensitiveView(actor, "/r/" + refStr, ["record"]);

  const kind = KIND[parsed.kind];
  const version = index.latestVersion;
  const cites = (index.linesBySource.get(refStr) ?? []).slice().sort((a, b) => index.versionOrder.indexOf(b.version) - index.versionOrder.indexOf(a.version) || a.key.localeCompare(b.key));
  const citesNow = cites.filter((c) => c.version === version);
  const citesBefore = cites.filter((c) => c.version !== version);
  const groups: [string, typeof cites][] = [
    ["Working version · " + version, citesNow],
    ["Earlier versions", citesBefore],
  ];
  const scalar = data === null || typeof data !== "object";
  const summary = ledger.summary(refStr);
  const pointer = parsed.kind === "prior_year" ? { prefix: "py", pointer: parsed.pointer } : parsed.kind === "agency" ? { prefix: "agency", pointer: parsed.pointer } : null;
  const fieldCount = data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data as object).length : Array.isArray(data) ? data.length : 0;

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-1.5">
            {kind?.list ? (
              <>
                <Link href={kind.list.href} className="hover:underline">
                  {kind.list.label}
                </Link>
                <span className="text-border-strong">/</span>
              </>
            ) : null}
            <span>{kind?.label ?? "Packet record"}</span>
            <span className="text-border-strong">/</span>
            {pointer ? <PointerTrail prefix={pointer.prefix} pointer={pointer.pointer} /> : <span className="font-mono">{refStr}</span>}
          </span>
        }
        title={
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/25">{kind?.icon ?? <Braces className="h-4 w-4" />}</span>
            <span className="min-w-0 break-words">{resolved.title}</span>
          </span>
        }
        description={
          <>
            {resolved.subtitle ? <span className="text-foreground">{resolved.subtitle}. </span> : null}
            {kind?.hint ?? "A record from the packet, shown as delivered."}
          </>
        }
        meta={
          <>
            <Badge tone="neutral" mono>
              {refStr}
            </Badge>
            {citesNow.length ? (
              <Badge tone="accent" dot>
                cited by {citesNow.length} line{citesNow.length === 1 ? "" : "s"} in {version}
              </Badge>
            ) : (
              <Badge tone="neutral">no return line cites this</Badge>
            )}
            {hasSensitive ? <Badge tone="warn">{reveal ? "reveal on · logged" : "masked"}</Badge> : null}
            <Marks s={summary} />
          </>
        }
        actions={
          <Pill href={"/search?q=" + encodeURIComponent(refStr)} icon={<Search className="h-3.5 w-3.5" />}>
            Find mentions
          </Pill>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid content-start gap-4 xl:col-span-2">
          {scalar ? (
            <section className="card p-5">
              <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Value</div>
              <div className="mt-2 font-mono text-[36px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{typeof data === "number" ? fmtLineValue(data) : String(data ?? "—")}</div>
              {pointer ? (
                <p className="mt-3 text-[12.5px] leading-5 text-muted">
                  One figure inside a larger record. Go up a level to see it with its neighbours:{" "}
                  <Link href={"/r/" + encodeURIComponent(pointer.prefix + ":/" + pointer.pointer.split("/").filter(Boolean).slice(0, -1).join("/"))} className="text-accent hover:underline">
                    {pointer.pointer.split("/").filter(Boolean).slice(0, -1).join(" / ") || "root"}
                  </Link>
                </p>
              ) : null}
            </section>
          ) : (
            <Card title="Record" description="Every field as the packet delivered it, in plain rows. References are links; dates and numbers are formatted, never changed." aside={fieldCount + (Array.isArray(data) ? " items" : " fields")}>
              <DataView data={data} />
            </Card>
          )}

          <Card title="Cited by return lines" description="Lines that name this record as a source. The working version comes first; earlier versions are kept for the record." aside={cites.length + " citation" + (cites.length === 1 ? "" : "s")} flush>
            {cites.length === 0 ? (
              <div className="p-5">
                <Empty>No return line cites this record directly.</Empty>
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
                            const l = index.lines.get(c.version)?.get(c.key);
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

          <details className="card group overflow-hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3 text-[13px] font-medium marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <Braces className="h-3.5 w-3.5 text-muted" />
                As delivered in the packet
              </span>
              <span className="text-[11.5px] font-normal text-muted group-open:hidden">show JSON</span>
              <span className="hidden text-[11.5px] font-normal text-muted group-open:inline">hide</span>
            </summary>
            <pre className="scroll-thin max-h-[480px] overflow-auto whitespace-pre-wrap border-t border-border bg-surface-2/30 p-4 font-mono text-[11.5px] leading-5">{JSON.stringify(data, null, 2)}</pre>
          </details>
        </div>

        <div className="grid content-start gap-4">
          <FactsPanel target={refStr} facts={ledger.forTarget(refStr)} actor={ctx.actor} staff={ctx.staff} verificationTypes={ctx.verificationTypes} />
          <div className="flex items-start gap-2 px-1 text-[11.5px] leading-4 text-muted">
            <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <span>The packet is read-only. Anything you verify, note, ask or attach here is written to the ledger against this reference and shows up wherever it is cited.</span>
          </div>
        </div>
      </div>
    </>
  );
}
