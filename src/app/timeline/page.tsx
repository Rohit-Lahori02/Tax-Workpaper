import { ArrowRight, CalendarClock, CheckCircle2, Circle, FileText, History, Mail, MessageSquare, Send, Sparkles, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { ClearNowButton, SetNowButton } from "@/components/timeline/now-cursor";
import { Badge, Card, cn, type Tone } from "@/components/ui";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { canSeeLedger } from "@/lib/permissions";
import { hrefFor } from "@/lib/refs";
import { getReviewContext } from "@/lib/review";
import { asOf, seasonEvents, type SeasonEventKind } from "@/lib/season";
import { getCurrentActor, getNow } from "@/lib/session";

export const metadata: Metadata = { title: "Timeline" };

const KIND_META: Record<SeasonEventKind, { label: string; tone: Tone; icon: typeof FileText }> = {
  engagement: { label: "engagement", tone: "neutral", icon: UserRound },
  document: { label: "document", tone: "neutral", icon: FileText },
  version: { label: "return computed", tone: "accent", icon: Sparkles },
  message: { label: "client message", tone: "accent", icon: MessageSquare },
  fact: { label: "workpaper record", tone: "ok", icon: History },
  agency: { label: "agency", tone: "warn", icon: Mail },
  deadline: { label: "deadline", tone: "warn", icon: CalendarClock },
  filing: { label: "filing", tone: "danger", icon: Send },
};

const NODE: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted ring-border",
  accent: "bg-accent-soft text-accent ring-accent/25",
  ok: "bg-ok-soft text-ok ring-ok/25",
  warn: "bg-warn-soft text-warn ring-warn/25",
  danger: "bg-danger-soft text-danger ring-danger/25",
};

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

export default async function TimelinePage() {
  const actor = await getCurrentActor();
  const ctx = await getReviewContext();
  const now = await getNow();
  const staff = canSeeLedger(actor);
  const events = seasonEvents(ctx.packet, ctx.ledger).filter((e) => staff || (e.kind !== "fact" && !(e.kind === "filing" && e.id.startsWith("fact:"))));
  const state = asOf(ctx.packet, ctx.ledger, events, now.iso);
  const realNow = new Date().toISOString();
  const version = state.version ? ctx.index.versions.get(state.version) : undefined;
  const transcript = [...ctx.packet.tax_agency_records.irs_account_transcript_2025].filter((t) => t.as_of + "T23:59:59Z" <= now.iso).at(-1) ?? null;

  const jumps: { label: string; iso: string }[] = [
    ...ctx.packet.return_versions.map((v) => ({ label: v.version + " computed", iso: v.computed_at })),
    ...ctx.packet.timeline
      .filter((t) => ["extension_filed_with_payment", "efile_rejected", "efile_accepted_federal", "federal_balance_paid", "notice_received"].includes(t.event))
      .map((t) => ({ label: t.event === "extension_filed_with_payment" ? "extension" : t.event === "efile_rejected" ? "e-file rejected" : t.event === "efile_accepted_federal" ? "e-file accepted" : t.event === "federal_balance_paid" ? "balance paid" : "notice received", iso: t.at })),
  ].sort((a, b) => a.iso.localeCompare(b.iso));

  const groups: { month: string; items: typeof events }[] = [];
  for (const e of events) {
    const m = monthFmt.format(new Date(e.at));
    const g = groups.at(-1);
    if (g && g.month === m) g.items.push(e);
    else groups.push({ month: m, items: [e] });
  }

  const milestones: [string, boolean][] = [
    ["Extension filed", state.milestones.extension],
    ["Return transmitted", state.milestones.transmitted],
    ["E-file rejected once", state.milestones.rejected],
    ["E-file accepted", state.milestones.accepted],
    ["Federal balance paid", state.milestones.paid],
    ["Examination notice received", state.milestones.notice],
  ];
  const kinds = (Object.keys(KIND_META) as SeasonEventKind[]).filter((k) => events.some((e) => e.kind === k));

  return (
    <>
      <PageHeader
        eyebrow="Filing"
        title="Timeline"
        description="Everything that happened to this file, from the engagement letter to the examination notice two years later, in one order. Set the cursor on any moment to see the file as it stood then: which documents had arrived, which return was current, what had been recorded."
        meta={
          <>
            <Badge tone={now.replay ? "accent" : "neutral"} dot>
              {now.replay ? "replaying: " + fmtDateTime(now.iso) : "live: " + fmtDateTime(realNow)}
            </Badge>
            <Badge tone="neutral">{events.length} events</Badge>
            <Badge tone="neutral">{state.past.length} so far</Badge>
          </>
        }
        actions={now.replay ? <ClearNowButton /> : null}
      />

      <div className="card mb-4 flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Jump to</span>
        {jumps.map((j) => (
          <SetNowButton key={j.label + j.iso} iso={j.iso} label={j.label} active={now.replay && now.iso === new Date(j.iso).toISOString()} />
        ))}
        <SetNowButton iso={realNow} label="today" active={!now.replay} />
        <span className="ml-auto hidden items-center gap-3 text-[11px] text-muted lg:flex">
          {kinds.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", k === "fact" ? "bg-ok" : k === "filing" ? "bg-danger" : k === "agency" || k === "deadline" ? "bg-warn" : k === "version" || k === "message" ? "bg-accent" : "bg-border-strong")} />
              {KIND_META[k].label}
            </span>
          ))}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* A plain card, not <Card>: its overflow clipping would pin the sticky month headers to the card instead of the viewport. */}
        <div className="card">
          <ol>
            {groups.map((g) => (
              <li key={g.month} className="first:[&>div]:rounded-t-[inherit]">
                <div className="sticky top-[56px] z-10 flex items-center justify-between border-b border-border bg-surface-2/90 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted backdrop-blur">
                  {g.month}
                  <span className="font-mono text-[10px] normal-case tracking-normal">{g.items.length}</span>
                </div>
                <ul>
                  {g.items.map((e, i) => {
                    const meta = KIND_META[e.kind];
                    const Icon = meta.icon;
                    const ahead = e.at > now.iso;
                    const active = now.replay && e.at === now.iso;
                    const at = new Date(e.at);
                    const last = i === g.items.length - 1;
                    return (
                      <li key={e.id} id={e.id} className={cn("group relative grid grid-cols-[76px_28px_minmax(0,1fr)] gap-x-3 px-5 py-2.5 transition-colors hover:bg-surface-2/40", ahead && "opacity-55", active && "bg-accent-soft/40 hover:bg-accent-soft/40")}>
                        <div className="pt-0.5 text-right">
                          <div className="text-[12px] font-medium tabular-nums">{dayFmt.format(at)}</div>
                          <div className="text-[11px] tabular-nums text-muted">{timeFmt.format(at)}</div>
                        </div>
                        <div className="relative flex justify-center">
                          {!last ? <span className={cn("absolute bottom-[-10px] top-[26px] w-px", ahead ? "border-l border-dashed border-border" : "bg-border")} /> : null}
                          <span className={cn("relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", NODE[meta.tone], active && "ring-2 ring-accent")}>
                            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="break-words text-[13px] font-medium leading-5">{e.title}</span>
                              <Badge tone={meta.tone}>{meta.label}</Badge>
                              {e.scheduled ? <Badge tone="neutral">scheduled</Badge> : null}
                              {ahead ? <Badge tone="neutral">not yet</Badge> : null}
                            </div>
                            <SetNowButton iso={e.at} active={active} quiet className="shrink-0" />
                          </div>
                          {e.detail ? <p className="mt-0.5 break-words text-[12.5px] leading-5 text-muted">{e.detail}</p> : null}
                          {e.actor || e.refs.length ? (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted">
                              {e.actor ? <span className="mr-1">by {e.actor}</span> : null}
                              {e.refs.slice(0, 6).map((r) => (
                                <RefLink key={r} refId={r} href={hrefFor(r)} />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid content-start gap-4 xl:sticky xl:top-[72px] xl:self-start">
          <Card title={now.replay ? "The file as of " + fmtDate(now.iso) : "The file today"} description={now.replay ? fmtDateTime(now.iso) : fmtDateTime(realNow)}>
            <div className="grid grid-cols-2 divide-x divide-border rounded-lg border border-border bg-surface-2/40">
              <div className="px-3 py-2.5">
                <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">Documents in</div>
                <div className="mt-1 text-[22px] font-semibold leading-none tabular-nums tracking-[-0.02em]">
                  {state.documentsReceived}
                  <span className="ml-1 text-[12px] font-normal text-muted">of {state.documentsTotal}</span>
                </div>
              </div>
              <div className="px-3 py-2.5">
                <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">Return</div>
                <div className="mt-1 text-[22px] font-semibold leading-none tabular-nums tracking-[-0.02em]">{state.version ?? "none"}</div>
                <div className="mt-1 text-[11px] text-muted">{state.versionComputedAt ? fmtDate(state.versionComputedAt) : "not yet computed"}</div>
              </div>
            </div>
            {version ? (
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1.5 text-[12.5px]">
                <dt className="text-muted">Federal total tax</dt>
                <dd className="tabular-nums">{fmtMoney(version.summary.federal.total_tax)}</dd>
                <dt className="text-muted">Federal balance</dt>
                <dd className="tabular-nums">{fmtMoney(version.summary.federal.balance_due)}</dd>
                <dt className="text-muted">California balance</dt>
                <dd className="tabular-nums">{fmtMoney(version.summary.california.balance_due)}</dd>
                <dt className="text-muted">Documents used</dt>
                <dd className="tabular-nums">{version.documents_used.length}</dd>
              </dl>
            ) : (
              <p className="mt-3 text-[12.5px] text-muted">No return had been computed yet. The client was still uploading.</p>
            )}
            {staff ? (
              <p className="mt-3 border-t border-border pt-3 text-[12px] text-muted">
                <span className="font-medium text-foreground">{state.factsRecorded}</span> workpaper record{state.factsRecorded === 1 ? "" : "s"} existed at this moment.
              </p>
            ) : null}
          </Card>

          <Card title="Milestones" description="Reached by the packet's own history or by this workpaper.">
            <ul className="grid gap-2 text-[13px]">
              {milestones.map(([label, done]) => (
                <li key={label} className="flex items-center gap-2.5">
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-full ring-1 ring-inset", done ? "bg-ok-soft text-ok ring-ok/25" : "bg-surface-2 text-border-strong ring-border")}>{done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}</span>
                  <span className={done ? "" : "text-muted"}>{label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {[
                ["/filing", "Filing"],
                ["/client-copy", "Client copy"],
                ["/notices", "Notices"],
                ["/next-year", "Next year"],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="chip h-7">
                  {label} <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          </Card>

          <Card title="IRS account transcript" description={transcript ? "Snapshot as of " + fmtDate(transcript.as_of) : "No transcript had been pulled yet"} flush={Boolean(transcript)}>
            {transcript ? (
              <table className="tbl dense text-[12px]">
                <tbody>
                  {transcript.transactions.map((t, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap pl-5 tabular-nums text-muted">{fmtDate(t.date)}</td>
                      <td className="font-mono text-[10.5px] text-muted">{t.code}</td>
                      <td className="leading-4">{t.description}</td>
                      <td className="pr-5 text-right tabular-nums">{typeof t.amount === "number" ? fmtMoney(t.amount) : <span className="text-[11px] text-muted">{t.amount}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[12.5px] text-muted">The first transcript in the file is dated {fmtDate(ctx.packet.tax_agency_records.irs_account_transcript_2025[0].as_of)}.</p>
            )}
          </Card>

          {state.nextEvent ? (
            <Card title="Next on the timeline">
              <div className="text-[13px] font-medium">{state.nextEvent.title}</div>
              <div className="mt-0.5 text-[12px] text-muted">{fmtDateTime(state.nextEvent.at)}</div>
              <SetNowButton iso={state.nextEvent.at} label="step forward" className="mt-3" />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
