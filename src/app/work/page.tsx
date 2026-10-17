import { AlertTriangle, CalendarClock, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { AssignmentForm } from "@/components/review/assignment-form";
import { Badge, Card, cn, Empty, SectionTitle, Stat } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { canAssign } from "@/lib/permissions";
import { getReviewContext, needsYou } from "@/lib/review";
import { ROLE_LABELS } from "@/lib/roles";
import { getCurrentActor } from "@/lib/session";

export const metadata: Metadata = { title: "My work" };

const DAY = 86400000;

export default async function WorkPage() {
  const actor = await getCurrentActor();
  const ctx = await getReviewContext();
  const now = new Date();
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

  return (
    <>
      <PageHeader
        title={actor.kind === "client" ? "Your to-do list" : "My work"}
        description={
          actor.kind === "client"
            ? "Questions your preparer needs answered and the approval of your return when it is ready."
            : "What waits on you, derived from the ledger and the firm's rules: questions addressed to you, sign-offs you can make now, your sign-offs that reopened, blocking notes on your areas, and deadlines."
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Needs you" value={items.length} tone={items.length ? "warn" : "ok"} hint={actor.name} />
        <Stat label="Your assignments" value={mine.length} hint={[...new Set(mine.map((a) => a.role))].join(", ") || "none"} />
        <Stat label="Overdue" value={deadlines.filter((d) => daysTo(d.date) < 0).length} tone={deadlines.some((d) => daysTo(d.date) < 0) ? "danger" : "ok"} hint={"as of " + fmtDate(now.toISOString())} />
        <Stat label="Open questions" value={ctx.ledger.questions.filter((q) => !q.retracted && q.answers.every((a) => a.retracted)).length} hint="across the engagement" />
      </div>

      <section className="mt-6">
        <SectionTitle>Needs you</SectionTitle>
        <Card flush>
          {items.length === 0 ? (
            <div className="p-4">
              <Empty>Nothing waits on you right now.</Empty>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((i, n) => (
                <li key={n} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5">
                    {i.kind === "deadline" ? <CalendarClock className={cn("h-4 w-4", i.overdue ? "text-danger" : "text-warn")} /> : i.kind === "blocking" || i.kind === "reopened" ? <AlertTriangle className="h-4 w-4 text-warn" /> : <Inbox className="h-4 w-4 text-accent" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={i.href} className="text-[13.5px] font-medium hover:underline">
                      {i.title}
                    </Link>
                    <p className="line-clamp-2 text-[12.5px] text-muted">{i.detail}</p>
                  </div>
                  <Badge tone={i.kind === "deadline" ? (i.overdue ? "danger" : "warn") : i.kind === "question" || i.kind === "client-approval" ? "accent" : "neutral"}>{i.kind.replace("-", " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {actor.kind === "staff" ? (
        <section className="mt-6">
          <SectionTitle>Assignments</SectionTitle>
          <Card description="Who prepares, reviews and signs each area. The firm's starting assignment applies until changed; changes are facts with their own history." flush>
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
                  {ctx.scopes.map((s) => (
                    <tr key={s.id} className={cn(s.id === "return" && "bg-surface-2/60")}>
                      <td className="font-medium">{s.label}</td>
                      {["preparer", "reviewer", "partner"].map((role) => {
                        const a = byScope.get(s.id)?.find((x) => x.role === role);
                        return (
                          <td key={role} className="align-top">
                            {a ? <AssignmentForm scope={s.id} role={role} assigneeId={a.assigneeId} due={a.due} staff={staff} allowed={canAssign(actor)} /> : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      ) : null}

      <section className="mt-6">
        <SectionTitle>Deadlines</SectionTitle>
        <Card flush>
          <table className="tbl dense">
            <thead>
              <tr>
                <th>Date</th>
                <th>What</th>
                <th>Who</th>
                <th className="num">Days</th>
              </tr>
            </thead>
            <tbody>
              {deadlines.map((d, i) => {
                const days = daysTo(d.date);
                return (
                  <tr key={i} className={cn(days < 0 && "text-muted")}>
                    <td className="whitespace-nowrap font-mono text-[12px]">{d.date}</td>
                    <td>{d.what}</td>
                    <td className="text-muted">{d.who ?? "firm"}</td>
                    <td className={cn("num", days < 0 ? "text-danger" : days <= 14 ? "text-warn" : "")}>{days < 0 ? Math.abs(days) + " ago" : days}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </section>

      <p className="mt-4 text-[12px] text-muted">
        Acting as {actor.name} · {ROLE_LABELS[actor.role]}.
      </p>
    </>
  );
}
