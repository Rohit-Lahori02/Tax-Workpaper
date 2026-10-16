import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivityTable } from "@/components/facts/activity-table";
import { PageHeader } from "@/components/page-header";
import { Card, Stat } from "@/components/ui";
import { getLedger } from "@/lib/facts/repo";
import { canSeeLedger } from "@/lib/permissions";
import { getCurrentActor } from "@/lib/session";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const actor = await getCurrentActor();
  if (!canSeeLedger(actor)) notFound();
  const { ledger } = await getLedger();
  const rows = ledger.all.slice().reverse();
  const count = (kind: string) => ledger.all.filter((f) => f.kind === kind && !f.retracted).length;

  return (
    <>
      <PageHeader
        title="Activity"
        description="The ledger itself: every verification, note, question, answer, attachment, retraction and unmasked view, in the order it happened. Nothing here can be edited or deleted; a mistake is corrected by a later record."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Verifications" value={count("verification")} tone="ok" />
        <Stat label="Notes" value={count("note")} hint={ledger.all.filter((f) => f.kind === "note" && !f.retracted && !f.resolved && f.body.blocking === true).length + " blocking open"} />
        <Stat label="Questions" value={count("question")} hint={ledger.questions.filter((q) => !q.retracted && q.answers.every((a) => a.retracted)).length + " open"} />
        <Stat label="Unmasked views" value={count("sensitive_view")} tone={count("sensitive_view") ? "warn" : undefined} />
      </div>
      <Card flush>
        <ActivityTable rows={rows} />
      </Card>
    </>
  );
}
