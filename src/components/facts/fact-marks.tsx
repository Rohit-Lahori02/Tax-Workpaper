import { CheckCircle2, MessageCircleQuestion, OctagonAlert, Paperclip, PencilLine, StickyNote } from "lucide-react";
import { cn } from "@/components/ui";
import type { TargetSummary } from "@/lib/facts/types";

/** Compact indicators of what the ledger holds for a target. Renders nothing when empty. */
export function Marks({ s, className }: { s: TargetSummary; className?: string }) {
  if (s.total === 0) return null;
  const plainNotes = s.openNotes - s.blockingOpen;
  return (
    <span className={cn("inline-flex items-center gap-1.5 align-middle", className)}>
      {s.adjustments ? (
        <span className="inline-flex items-center text-accent" title={s.adjustments + " adjustment(s)"}>
          <PencilLine className="h-3.5 w-3.5" />
        </span>
      ) : null}
      {s.verifications.length ? (
        <span className="inline-flex items-center gap-0.5 text-ok" title={"Verified: " + s.verifications.map(humanize).join(", ")}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          {s.verifications.length > 1 ? <span className="text-[11px] tabular-nums">{s.verifications.length}</span> : null}
        </span>
      ) : null}
      {s.blockingOpen ? (
        <span className="inline-flex items-center text-danger" title={s.blockingOpen + " blocking note(s) open"}>
          <OctagonAlert className="h-3.5 w-3.5" />
        </span>
      ) : null}
      {plainNotes > 0 ? (
        <span className="inline-flex items-center text-muted" title={plainNotes + " open note(s)"}>
          <StickyNote className="h-3.5 w-3.5" />
        </span>
      ) : null}
      {s.openQuestions ? (
        <span className="inline-flex items-center text-accent" title={s.openQuestions + " open question(s)"}>
          <MessageCircleQuestion className="h-3.5 w-3.5" />
        </span>
      ) : null}
      {s.attachments ? (
        <span className="inline-flex items-center text-muted" title={s.attachments + " attachment(s)"}>
          <Paperclip className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </span>
  );
}

export function humanize(code: string): string {
  return code.replace(/_/g, " ");
}
