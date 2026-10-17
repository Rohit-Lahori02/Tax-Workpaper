import { CalendarClock, CheckCircle2, Circle, FileText, History, Mail, MessageSquare, Send, Sparkles, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { ClearNowButton, SetNowButton } from "@/components/timeline/now-cursor";
import { Badge, Card, cn, KV, Stat, type Tone } from "@/components/ui";
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

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

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
    ...ctx.packet.timeline.filter((t) => ["extension_filed_with_payment", "efile_rejected", "efile_accepted_federal", "federal_balance_paid", "notice_received"].includes(t.event)).map((t) => ({ label: (t.event === "extension_filed_with_payment" ? "extension" : t.event === "efile_rejected" ? "e-file rejected" : t.event === "efile_accepted_federal" ? "e-file accepted" : t.event === "federal_balance_paid" ? "balance paid" : "notice received"), iso: t.at })),
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

  return (
    <>
      <PageHeader
        title="Timeline"
        description="Everything that happened to this file, from the engagement letter to the examination notice two years later, in one order. Set the cursor on any moment to see the file as it stood then: which documents had arrived, which return was current, what had been recorded."
        meta={
          <>
            <Badge tone={now.replay ? "accent" : "neutral"} dot>
              {now.replay ? "replaying: " + fmtDateTime(now.iso) : "live: " + fmtDateTime(realNow)}
            </Badge>
            <Badge tone="neutral">{events.length} events</Badge>
          </>
        }
        actions={now.replay ? <ClearNowButton /> : null}
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
        <span className="mr-1">Jump to</span>
        {jumps.map((j) => (
          <SetNowButton key={j.label + j.iso} iso={j.iso} label={j.label} active={now.replay && now.iso === new Date(j.iso).toISOString()} />
        ))}
        <SetNowButton iso={realNow} label="today" active={!now.replay} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* A plain card, not <Card>: its overflow clipping would pin the sticky month headers to the card instead of the viewport. */}
        <div className="card">
          <ol className="divide-y divide-border">
            {groups.map((g) => (
              <li key={g.month} className="first:[&>div]:rounded-t-[inherit]">
                <div className="sticky top-[52px] z-10 border-b border-border bg-surface-2/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted backdrop-blur">{g.month}</div>
                <ul className="divide-y divide-border/60">
                  {g.items.map((e) => {
                    const meta = KIND_META[e.kind];
                    const Icon = meta.icon;
                    const ahead = e.at > now.iso;
                    const active = now.replay && e.at === now.iso;
                    return (
                      <li key={e.id} id={e.id} className={cn("flex items-start gap-3 px-4 py-2.5", ahead && "opacity-55", active && "bg-accent-soft/50")}>
                        <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", meta.tone === "ok" ? "bg-ok-soft text-ok" : meta.tone === "warn" ? "bg-warn-soft text-warn" : meta.tone === "danger" ? "bg-danger-soft text-danger" : meta.tone === "accent" ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted")}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-[13px] font-medium">{e.title}</span>
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                            {e.scheduled ? <Badge tone="neutral">scheduled</Badge> : null}
                            {ahead ? <Badge tone="neutral">not yet</Badge> : null}
                          </div>
                          {e.detail ? <p className="mt-0.5 text-[12.5px] leading-5 text-muted">{e.detail}</p> : null}
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
                            <span className="tabular-nums">{fmtDateTime(e.at)}</span>
                            {e.actor ? <span>by {e.actor}</span> : null}
                            {e.refs.slice(0, 6).map((r) => (
                              <RefLink key={r} refId={r} href={hrefFor(r)} />
                            ))}
                          </div>
                        </div>
                        <SetNowButton iso={e.at} active={active} className="mt-0.5 shrink-0" />
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid content-start gap-4 xl:sticky xl:top-[68px] xl:self-start">
          <Card title={now.replay ? "The file as of " + fmtDate(now.iso) : "The file today"} description={now.replay ? fmtDateTime(now.iso) : fmtDateTime(realNow)}>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Documents in" value={state.documentsReceived} hint={"of " + state.documentsTotal} />
              <Stat label="Return" value={state.version ?? "none"} hint={state.versionComputedAt ? fmtDate(state.versionComputedAt) : "not yet computed"} />
            </div>
            {version ? (
              <KV
                className="mt-3"
                rows={[
                  ["Federal total tax", fmtMoney(version.summary.federal.total_tax)],
                  ["Federal balance", fmtMoney(version.summary.federal.balance_due)],
                  ["California balance", fmtMoney(version.summary.california.balance_due)],
                  ["Documents used", String(version.documents_used.length)],
                ]}
              />
            ) : (
              <p className="mt-3 text-[12.5px] text-muted">No return had been computed yet. The client was still uploading.</p>
            )}
            {staff ? <p className="mt-3 text-[12px] text-muted">{state.factsRecorded} workpaper record{state.factsRecorded === 1 ? "" : "s"} existed at this moment.</p> : null}
          </Card>

          <Card title="Milestones">
            <ul className="grid gap-1.5 text-[13px]">
              {milestones.map(([label, done]) => (
                <li key={label} className="flex items-center gap-2">
                  {done ? <CheckCircle2 className="h-4 w-4 text-ok" /> : <Circle className="h-4 w-4 text-border-strong" />}
                  <span className={done ? "" : "text-muted"}>{label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
              <Link href="/filing" className="text-accent hover:underline">
                Filing
              </Link>
              <Link href="/client-copy" className="text-accent hover:underline">
                Client copy
              </Link>
              <Link href="/notices" className="text-accent hover:underline">
                Notices
              </Link>
              <Link href="/next-year" className="text-accent hover:underline">
                Next year
              </Link>
            </div>
          </Card>

          <Card title="IRS account transcript" description={transcript ? "Snapshot as of " + fmtDate(transcript.as_of) : "No transcript had been pulled yet"}>
            {transcript ? (
              <table className="tbl text-[12px]">
                <tbody>
                  {transcript.transactions.map((t, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap tabular-nums text-muted">{fmtDate(t.date)}</td>
                      <td className="font-mono text-[11px] text-muted">{t.code}</td>
                      <td>{t.description}</td>
                      <td className="text-right tabular-nums">{typeof t.amount === "number" ? fmtMoney(t.amount) : <span className="text-muted">{t.amount}</span>}</td>
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
              <SetNowButton iso={state.nextEvent.at} label="step forward" className="mt-2" />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
