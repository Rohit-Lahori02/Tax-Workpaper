"use client";

import { CheckCircle2, CornerDownRight, MessageCircleQuestion, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { RefLink } from "@/components/ref-link";
import { Badge, cn } from "@/components/ui";
import { answerAction } from "@/lib/facts/actions";
import type { FactView } from "@/lib/facts/types";
import { canAnswer, type ActorLite } from "@/lib/permissions";

const fmtWhen = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** One question with its thread of answers, and the reply box when the viewer may answer. */
export function QuestionCard({ q, actor, staffNames }: { q: FactView; actor: ActorLite; staffNames: Record<string, string> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const to = String(q.body.to ?? "");
  const toName = to === "client" ? "the client" : (staffNames[to] ?? to);
  const open = q.answers.every((a) => a.retracted);
  const toClient = to === "client";

  return (
    <article className={cn("card overflow-hidden", open && "ring-1 ring-inset ring-accent/20")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2/40 px-4 py-2 text-[12px] text-muted">
        <Badge tone={open ? "accent" : "ok"} dot>
          {open ? (
            <>
              <MessageCircleQuestion className="h-3 w-3" /> waiting on {toName}
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3 w-3" /> answered
            </>
          )}
        </Badge>
        <span>
          on <RefLink refId={q.target} />
        </span>
        <span className="ml-auto font-mono text-[11px]">{fmtWhen.format(new Date(q.at))}</span>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-[10px] font-semibold text-accent">{initials(q.actorName)}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] text-muted">
              <span className="font-medium text-foreground">{q.actorName}</span> asked {toName}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-6">{String(q.body.text ?? "")}</p>
          </div>
        </div>

        {q.answers.length ? (
          <ul className="mt-3 grid gap-2 pl-10">
            {q.answers.map((a) => (
              <li key={a.id} className={cn("flex items-start gap-3", a.retracted && "opacity-60")}>
                <CornerDownRight className="mt-2 h-3.5 w-3.5 shrink-0 text-border-strong" />
                <div className={cn("min-w-0 flex-1 rounded-lg border px-3 py-2", a.retracted ? "border-dashed border-border" : "border-ok/25 bg-ok-soft/40")}>
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-ok-soft text-[9px] font-semibold text-ok">{initials(a.actorName)}</span>
                    <span className="font-medium text-foreground">{a.actorName}</span>
                    {a.body.onBehalf === true ? <Badge tone="neutral">recorded for the client</Badge> : null}
                    {a.retracted ? <Badge tone="warn">retracted</Badge> : null}
                    <span className="ml-auto font-mono text-[11px]">{fmtWhen.format(new Date(a.at))}</span>
                  </div>
                  <p className={cn("mt-1 whitespace-pre-wrap text-[13px] leading-5", a.retracted && "line-through")}>{String(a.body.text ?? "")}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {open && canAnswer(actor, to) ? (
          <form
            className="mt-3 grid gap-2 pl-10"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fd = new FormData(form);
              start(async () => {
                setError(null);
                const r = await answerAction(fd);
                if (r.ok) form.reset();
                else setError(r.error);
              });
            }}
          >
            <input type="hidden" name="questionId" value={q.id} />
            <textarea name="text" rows={2} required placeholder={actor.kind === "client" ? "Type your answer" : toClient ? "Record what the client said" : "Your answer"} className="input" />
            <div className="flex items-center gap-2">
              <button type="submit" disabled={pending} className={cn("pill primary h-8", pending && "opacity-50")}>
                <Send className="h-3.5 w-3.5" /> {actor.kind === "staff" && toClient ? "Record client's answer" : "Send answer"}
              </button>
              {actor.kind === "staff" && toClient ? <span className="text-[11.5px] text-muted">Recorded on the client&apos;s behalf, marked as such.</span> : null}
              {error ? <span className="text-[12px] text-danger">{error}</span> : null}
            </div>
          </form>
        ) : null}
      </div>
    </article>
  );
}
