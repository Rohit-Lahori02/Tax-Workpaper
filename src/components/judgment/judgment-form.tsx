"use client";

import { Gavel } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge, cn } from "@/components/ui";
import { judgmentAction } from "@/lib/facts/actions-judgment";
import { JUDGMENT_LABELS, type JudgmentType } from "@/lib/facts/types";

export interface RecordedJudgment {
  actorName: string;
  at: string;
  text: string;
  authority?: string;
  choice?: string;
  status?: string;
  answers?: boolean[];
}

const input = "input";
const fmtWhen = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });

/**
 * Records a judgment of one type on one target. Collapsed to a button until
 * needed; shows the latest record and lets it be superseded by a new one.
 */
export function JudgmentForm({
  target,
  type,
  recorded,
  options,
  statuses,
  questions,
  requireAuthority,
  buttonLabel,
  placeholder,
  allowed,
  compact,
}: {
  target: string;
  type: JudgmentType;
  recorded: RecordedJudgment | null;
  options?: { id: string; label: string }[];
  statuses?: { id: string; label: string }[];
  questions?: string[];
  requireAuthority?: boolean;
  buttonLabel?: string;
  placeholder?: string;
  allowed: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const summary = recorded ? (
    <div className={cn("text-[12.5px]", compact ? "" : "rounded-lg border border-border bg-surface-2/60 px-3 py-2.5")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="ok">
          <Gavel className="h-3 w-3" /> {JUDGMENT_LABELS[type]}
        </Badge>
        {recorded.choice ? <span className="font-medium">{options?.find((o) => o.id === recorded.choice)?.label ?? recorded.choice}</span> : null}
        {recorded.status ? <Badge tone="accent">{statuses?.find((s) => s.id === recorded.status)?.label ?? recorded.status}</Badge> : null}
        <span className="text-muted">
          {recorded.actorName} · {fmtWhen.format(new Date(recorded.at))}
        </span>
      </div>
      <p className="mt-1 whitespace-pre-wrap">{recorded.text}</p>
      {recorded.authority ? <p className="mt-0.5 text-muted">Authority: {recorded.authority}</p> : null}
      {allowed ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-1 text-[12px] text-accent hover:underline">
          Record a new decision
        </button>
      ) : null}
    </div>
  ) : null;

  if (!open) {
    return (
      <div>
        {summary}
        {!recorded && allowed ? (
          <button type="button" onClick={() => setOpen(true)} className={cn("pill", compact && "h-7 px-2.5 text-[12px]")}>
            <Gavel className="h-3.5 w-3.5" /> {buttonLabel ?? "Record " + JUDGMENT_LABELS[type].toLowerCase()}
          </button>
        ) : null}
        {!recorded && !allowed ? <span className="text-[12px] text-muted">Not yet recorded.</span> : null}
      </div>
    );
  }

  return (
    <form
      className="grid gap-2 rounded-lg border border-border bg-surface-2/40 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          setError(null);
          const r = await judgmentAction(fd);
          if (r.ok) {
            form.reset();
            setOpen(false);
          } else setError(r.error);
        });
      }}
    >
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="type" value={type} />
      {options?.length ? (
        <div className="grid gap-1">
          {options.map((o, i) => (
            <label key={o.id} className="flex items-center gap-2 text-[12.5px]">
              <input type="radio" name="choice" value={o.id} defaultChecked={recorded?.choice ? recorded.choice === o.id : i === 0} className="accent-[var(--accent)]" />
              {o.label}
            </label>
          ))}
        </div>
      ) : null}
      {statuses?.length ? (
        <select name="status" defaultValue={recorded?.status ?? statuses[0].id} className={cn(input, "w-auto")}>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      ) : null}
      {questions?.length ? (
        <div className="grid gap-1.5">
          <input type="hidden" name="answerCount" value={questions.length} />
          {questions.map((q, i) => (
            <label key={i} className="flex items-start gap-2 text-[12.5px]">
              <input type="checkbox" name="answers" value={i} className="mt-0.5 accent-[var(--accent)]" />
              {q}
            </label>
          ))}
        </div>
      ) : null}
      <textarea name="text" rows={3} required placeholder={placeholder ?? "What was decided and why"} className={input} />
      <input name="authority" placeholder={requireAuthority ? "Authority relied on (required): code section, regulation, publication" : "Authority relied on (optional)"} required={requireAuthority} className={input} />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="pill primary h-8">
          Record
        </button>
        <button type="button" onClick={() => setOpen(false)} className="pill h-8">
          Cancel
        </button>
        {error ? <span className="text-[12px] text-danger">{error}</span> : null}
      </div>
    </form>
  );
}
