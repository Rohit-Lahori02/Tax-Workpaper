"use client";

import { MessageCircleQuestion } from "lucide-react";
import { useState, useTransition } from "react";
import { RefLink } from "@/components/ref-link";
import { Badge, cn } from "@/components/ui";
import { answerAction } from "@/lib/facts/actions";
import type { FactView } from "@/lib/facts/types";
import { canAnswer, type ActorLite } from "@/lib/permissions";

const fmtWhen = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });

export function QuestionCard({ q, actor, staffNames }: { q: FactView; actor: ActorLite; staffNames: Record<string, string> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const to = String(q.body.to ?? "");
  const toName = to === "client" ? "the client" : (staffNames[to] ?? to);
  const open = q.answers.every((a) => a.retracted);

  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
        <Badge tone={open ? "accent" : "ok"}>
          <MessageCircleQuestion className="h-3 w-3" /> {open ? "waiting on " + toName : "answered"}
        </Badge>
        <span>
          asked by <span className="text-foreground">{q.actorName}</span> · {fmtWhen.format(new Date(q.at))}
        </span>
        <span>·</span>
        <span>
          on <RefLink refId={q.target} />
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[13.5px]">{String(q.body.text ?? "")}</p>
      {q.answers.length ? (
        <ul className="mt-3 grid gap-2 border-l-2 border-border pl-3">
          {q.answers.map((a) => (
            <li key={a.id} className={cn(a.retracted && "line-through opacity-60")}>
              <div className="text-[12px] text-muted">
                {a.actorName}
                {a.body.onBehalf === true ? " (recorded for the client)" : ""} · {fmtWhen.format(new Date(a.at))}
              </div>
              <p className="whitespace-pre-wrap text-[13px]">{String(a.body.text ?? "")}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {open && canAnswer(actor, to) ? (
        <form
          className="mt-3 grid gap-2"
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
          <textarea
            name="text"
            rows={2}
            required
            placeholder={actor.kind === "client" ? "Type your answer" : to === "client" ? "Record what the client said" : "Your answer"}
            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending} className="rounded-full bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-fg disabled:opacity-50">
              {actor.kind === "staff" && to === "client" ? "Record client's answer" : "Send answer"}
            </button>
            {error ? <span className="text-[12px] text-danger">{error}</span> : null}
          </div>
        </form>
      ) : null}
    </article>
  );
}
