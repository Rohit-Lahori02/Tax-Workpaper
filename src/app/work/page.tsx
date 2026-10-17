import { AlertTriangle, ArrowUpRight, CalendarClock, FileSignature, Inbox, Mail, MessageCircleQuestion, OctagonAlert, PenLine, RotateCcw, Send, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { AssignmentForm } from "@/components/review/assignment-form";
import { Badge, Card, cn, Empty, Stat, type Tone } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { canAssign } from "@/lib/permissions";
import { getReviewContext, needsYou, type NeedsYouItem } from "@/lib/review";
import { ROLE_LABELS } from "@/lib/roles";
import { getCurrentActor, getNow } from "@/lib/session";

export const metadata: Metadata = { title: "My work" };

const DAY = 86400000;

const KIND: Record<NeedsYouItem["kind"], { label: string; tone: Tone; icon: typeof Inbox; group: "act" | "attention" | "deadline" }> = {
  question: { label: "answer", tone: "accent", icon: MessageCircleQuestion, group: "act" },
  signoff: { label: "sign off", tone: "accent", icon: PenLine, group: "act" },
  approval: { label: "approve", tone: "accent", icon: ShieldCheck, group: "act" },
  "client-approval": { label: "approve and sign", tone: "accent", icon: FileSignature, group: "act" },
  reopened: { label: "reopened", tone: "warn", icon: RotateCcw, group: "attention" },
  blocking: { label: "blocking note", tone: "danger", icon: OctagonAlert, group: "attention" },
  filing: { label: "filing", tone: "warn", icon: Send, group: "attention" },
  notice: { label: "notice", tone: "warn", icon: Mail, group: "attention" },
  deadline: { label: "deadline", tone: "warn", icon: CalendarClock, group: "deadline" },
};

const RING: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted ring-border",
  accent: "bg-accent-soft text-accent ring-accent/25",
  ok: "bg-ok-soft text-ok ring-ok/25",
  warn: "bg-warn-soft text-warn ring-warn/25",
  danger: "bg-danger-soft text-danger ring-danger/25",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function WorkPage() {
  const actor = await getCurrentActor();
  const ctx = await getReviewContext();
  const nowState = await getNow();
  const now = new Date(nowState.iso);
  const items = needsYou(ctx, actor, now);
  const staff = ctx.packet.firm.staff.map((s) => ({ id: s.id, name: s.name, role: s.role }));
  const byScope = new Map<string, typeof ctx.assignments>();
  for (const a of ctx.assignments) byScope.set(a.scope, [...(byScope.get(a.scope) ?? []), a]);

  const deadlines = [
    ...ctx.packet.firm.deadlines.map((d) => ({ what: d.what, date: d.date, who: null as string | null })),
    ...ctx.assignments.filter((a) => a.due).map((a) => ({ what: a.role + " · " + (ctx.scopes.find((s) => s.id === a.scope)?.label ?? a.scope), date: a.due!, who: staff.find((s) => s.id === a.assigneeId)?.name ?? a.assigneeId })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const daysTo = (d: string) => Math.ceil((Date.parse(d) - now.getTime()) / DAY);
  const mine = ctx.assignments.filter((a) => a.assigneeId === actor.id);
  const overdueItems = items.filter((i) => i.overdue).length;
  const groups = (["act", "attention", "deadline"] as const)
    .map((g) => ({ g, label: g === "act" ? "Ready for you" : g === "attention" ? "Needs attention" : "Coming up", items: items.filter((i) => KIND[i.kind].group === g) }))
    .filter((x) => x.items.length);
  const openQuestions = ctx.ledger.questions.filter((q) => !q.retracted && q.answers.every((a) => a.retracted)).length;
  const upcoming = deadlines.filter((d) => daysTo(d.date) >= 0);

  return (
    <>
      <PageHeader
        eyebrow={actor.kind === "client" ? "Client" : "Workspace"}
        title={actor.kind === "client" ? "Your to-do list" : "My work"}
        description={
          actor.kind === "client"
            ? "Questions your preparer needs answered and the approval of your return when it is ready."
            : "What waits on you, derived from the ledger and the firm's rules: questions addressed to you, sign-offs you can make now, your sign-offs that reopened, blocking notes on your areas, and deadlines."
        }
        meta={
          <>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-0.5 pl-0.5 pr-2.5 text-[12px]">
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[9.5px] font-semibold", actor.kind === "client" ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent")}>{initials(actor.name)}</span>
              {actor.name} · {ROLE_LABELS[actor.role]}
            </span>
            <Badge tone={items.length ? "warn" : "ok"} dot>
              {items.length ? items.length + " item" + (items.length === 1 ? "" : "s") + " waiting" : "nothing waiting"}
            </Badge>
            {overdueItems ? (
              <Badge tone="danger" dot>
                {overdueItems} overdue
              </Badge>
            ) : null}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Needs you" value={items.length} tone={items.length ? "warn" : "ok"} hint={actor.name} />
        <Stat label="Your assignments" value={mine.length} hint={[...new Set(mine.map((a) => a.role))].join(", ") || "none"} />
        <Stat label="Next deadline" value={upcoming[0] ? fmtDate(upcoming[0].date) : "—"} hint={upcoming[0] ? upcoming[0].what : deadlines.length + " passed"} tone={upcoming[0] && daysTo(upcoming[0].date) <= 14 ? "warn" : undefined} />
        <Stat label="Open questions" value={openQuestions} hint="across the engagement" />
      </div>

      <Card className="mt-4" title={<span className="flex items-center gap-2"><Inbox className="h-4 w-4 text-warn" /> Needs you</span>} description="Each line is a rule the firm set, applied to the ledger right now. Do the thing and the line disappears." flush={items.length > 0}>
        {items.length === 0 ? (
          <Empty>Nothing waits on you right now.</Empty>
        ) : (
          <div>
            {groups.map((grp) => (
              <div key={grp.g}>
                <div className="flex items-center justify-between border-b border-border bg-surface-2/50 px-5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {grp.label}
                  <span className="font-mono text-[10px] normal-case tracking-normal">{grp.items.length}</span>
                </div>
                <ul className="divide-y divide-border">
                  {grp.items.map((i, n) => {
                    const meta = KIND[i.kind];
                    const Icon = meta.icon;
                    const tone: Tone = i.overdue ? "danger" : meta.tone;
                    return (
                      <li key={grp.g + n}>
                        <Link href={i.href} className="group flex items-start gap-3 px-5 py-3 transition-colors hover:bg-surface-2/50">
                          <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", RING[tone])}>
                            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-[13.5px] font-medium leading-5">{i.title}</span>
                              <Badge tone={tone}>{i.overdue ? "overdue" : meta.label}</Badge>
                              {i.due ? <span className="font-mono text-[11px] text-muted">{i.due}</span> : null}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-5 text-muted">{i.detail}</span>
                          </span>
                          <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-[12px] text-muted opacity-0 transition-opacity group-hover:opacity-100">
                            open <ArrowUpRight className="h-3 w-3" />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {actor.kind === "staff" ? (
          <Card className="xl:col-span-2" title="Assignments" description="Who prepares, reviews and signs each area. The firm's starting assignment applies until changed; changes are facts with their own history." flush>
            <div className="overflow-auto">
              <table className="tbl dense">
                <thead>
                  <tr>
                    <th>Scope</th>
                    <th>Preparer</th>
                    <th>Reviewer</th>
                    <th>Partner</th>
                  </tr>
                </thead>
                <tbody>
                  {ctx.scopes.map((s) => {
                    const whole = s.id === "return";
                    const minePresent = byScope.get(s.id)?.some((a) => a.assigneeId === actor.id);
                    return (
                      <tr key={s.id} className={cn(whole && "bg-surface-2/50")}>
                        <td className={cn("relative pl-5", whole && "border-t-2 border-t-border font-semibold")}>
                          {minePresent ? <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r bg-accent" title="You are assigned here" /> : null}
                          {s.label}
                        </td>
                        {["preparer", "reviewer", "partner"].map((role) => {
                          const a = byScope.get(s.id)?.find((x) => x.role === role);
                          return (
                            <td key={role} className={cn("align-top", whole && "border-t-2 border-t-border")}>
                              {a ? <AssignmentForm scope={s.id} role={role} assigneeId={a.assigneeId} due={a.due} staff={staff} allowed={canAssign(actor)} /> : null}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        <Card title="Deadlines" description={upcoming.length ? upcoming.length + " ahead" : "Every listed deadline has passed."} flush>
          <ul className="divide-y divide-border">
            {deadlines.map((d, i) => {
              const days = daysTo(d.date);
              const past = days < 0;
              return (
                <li key={i} className={cn("flex items-start gap-3 px-5 py-2.5", past && "opacity-60")}>
                  <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset", past ? "bg-surface-2 text-muted ring-border" : days <= 14 ? RING.warn : RING.neutral)}>
                    {past ? <AlertTriangle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] leading-5">{d.what}</span>
                    <span className="block text-[11px] text-muted">
                      <span className={cn("font-mono tabular-nums", past && "line-through decoration-border-strong")}>{fmtDate(d.date)}</span> · {d.who ?? "firm"}
                    </span>
                  </span>
                  <span className={cn("shrink-0 rounded-md px-1.5 font-mono text-[10.5px] leading-[18px]", past ? "bg-danger-soft text-danger" : days <= 14 ? "bg-warn-soft text-warn" : "bg-surface-2 text-muted")}>{past ? Math.abs(days) + "d ago" : "in " + days + "d"}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
