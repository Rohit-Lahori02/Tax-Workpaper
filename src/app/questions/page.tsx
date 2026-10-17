import { MessageCircleQuestion } from "lucide-react";
import type { Metadata } from "next";
import { QuestionCard } from "@/components/facts/question-card";
import { PageHeader } from "@/components/page-header";
import { Badge, Empty, SectionTitle, Stat } from "@/components/ui";
import { factsContext } from "@/lib/facts/context";
import { getLedger } from "@/lib/facts/repo";

export const metadata: Metadata = { title: "Questions" };

export default async function QuestionsPage() {
  const [{ ledger }, ctx] = await Promise.all([getLedger(), factsContext()]);
  const staffNames = Object.fromEntries(ctx.staff.map((s) => [s.id, s.name]));
  const visible = ledger.questions.filter((q) => !q.retracted && (ctx.actor.kind === "staff" || q.body.to === "client")).reverse();
  const open = visible.filter((q) => q.answers.every((a) => a.retracted));
  const answered = visible.filter((q) => !q.answers.every((a) => a.retracted));
  const forClient = open.filter((q) => q.body.to === "client");
  const forStaff = open.filter((q) => q.body.to !== "client");
  const forMe = open.filter((q) => (ctx.actor.kind === "client" ? q.body.to === "client" : q.body.to === ctx.actor.id)).length;
  const isClient = ctx.actor.kind === "client";

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Questions"
        description={isClient ? "Questions your preparer needs you to answer. Each answer is kept with the item it concerns." : "Everything asked of the client or a colleague. An answer lands on the line or document it was asked about and becomes evidence there."}
        meta={
          <>
            <Badge tone={forMe ? "accent" : "neutral"} dot>
              {forMe ? forMe + " waiting on you" : "nothing waiting on you"}
            </Badge>
            <Badge tone="neutral">{visible.length} in all</Badge>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Waiting on the client" value={forClient.length} tone={forClient.length ? "accent" : "ok"} hint="answers become evidence on the item" />
        {!isClient ? <Stat label="Waiting on staff" value={forStaff.length} tone={forStaff.length ? "warn" : "ok"} hint="addressed to a colleague" /> : null}
        <Stat label="Answered" value={answered.length} tone="ok" hint="kept with the item they concern" />
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-2">
        <div className="grid content-start gap-3">
          <SectionTitle className="flex items-center gap-2">
            <MessageCircleQuestion className="h-3.5 w-3.5 text-accent" /> Waiting on the client · {forClient.length}
          </SectionTitle>
          {forClient.length === 0 ? <Empty>Nothing waiting on the client.</Empty> : null}
          {forClient.map((q) => (
            <QuestionCard key={q.id} q={q} actor={ctx.actor} staffNames={staffNames} />
          ))}
          {!isClient ? (
            <>
              <SectionTitle className="mt-4 flex items-center gap-2">
                <MessageCircleQuestion className="h-3.5 w-3.5 text-warn" /> Waiting on staff · {forStaff.length}
              </SectionTitle>
              {forStaff.length === 0 ? <Empty>Nothing waiting on a colleague.</Empty> : null}
              {forStaff.map((q) => (
                <QuestionCard key={q.id} q={q} actor={ctx.actor} staffNames={staffNames} />
              ))}
            </>
          ) : null}
          <p className="mt-2 text-[12px] text-muted">To ask something new, open the line or document it concerns and use Ask on its evidence panel. The question stays attached to that item.</p>
        </div>
        <div className="grid content-start gap-3">
          <SectionTitle>Answered · {answered.length}</SectionTitle>
          {answered.length === 0 ? <Empty>No answers yet.</Empty> : null}
          {answered.map((q) => (
            <QuestionCard key={q.id} q={q} actor={ctx.actor} staffNames={staffNames} />
          ))}
        </div>
      </div>
    </>
  );
}
