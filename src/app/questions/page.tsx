import type { Metadata } from "next";
import { QuestionCard } from "@/components/facts/question-card";
import { PageHeader } from "@/components/page-header";
import { Empty, SectionTitle } from "@/components/ui";
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

  return (
    <>
      <PageHeader
        title="Questions"
        description={
          ctx.actor.kind === "client"
            ? "Questions your preparer needs you to answer. Each answer is kept with the item it concerns."
            : "Everything asked of the client or a colleague. An answer lands on the line or document it was asked about and becomes evidence there."
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="grid content-start gap-3">
          <SectionTitle>Waiting on the client · {forClient.length}</SectionTitle>
          {forClient.length === 0 ? <Empty>Nothing waiting on the client.</Empty> : null}
          {forClient.map((q) => (
            <QuestionCard key={q.id} q={q} actor={ctx.actor} staffNames={staffNames} />
          ))}
          {ctx.actor.kind === "staff" ? (
            <>
              <SectionTitle className="mt-4">Waiting on staff · {forStaff.length}</SectionTitle>
              {forStaff.length === 0 ? <Empty>Nothing waiting on a colleague.</Empty> : null}
              {forStaff.map((q) => (
                <QuestionCard key={q.id} q={q} actor={ctx.actor} staffNames={staffNames} />
              ))}
            </>
          ) : null}
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
