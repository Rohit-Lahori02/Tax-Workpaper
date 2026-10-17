"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, FileCheck2, FileSignature, Gavel, ListChecks, MessageCircleQuestion, OctagonAlert, Paperclip, PencilLine, Send, StickyNote, Undo2, UserCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { humanize } from "@/components/facts/fact-marks";
import { Badge, cn, type Tone } from "@/components/ui";
import { answerAction, askAction, attachAction, noteAction, resolveAction, retractAction, verifyAction, type ActionResult } from "@/lib/facts/actions";
import { DISPOSITION_LABELS, JUDGMENT_LABELS, type Disposition, type FactView, type JudgmentType } from "@/lib/facts/types";
import { canAnswer, canAsk, canAttach, canBlock, canNote, canResolve, canRetract, canVerify, type ActorLite } from "@/lib/permissions";
import { hrefFor } from "@/lib/refs";
import { ROLE_LABELS } from "@/lib/roles";

export interface StaffOption {
  id: string;
  name: string;
}

type Tab = "verify" | "note" | "ask" | "attach";

const fmtWhen = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const SHOW_FIRST = 6;

/** Submit helper: pending state, inline error, a short "recorded" flash on success. */
function useSubmit(action: (fd: FormData) => Promise<ActionResult>, onDone?: () => void) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 2500);
    return () => clearTimeout(t);
  }, [done]);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      setError(null);
      const r = await action(fd);
      if (r.ok) {
        form.reset();
        setDone(true);
        onDone?.();
      } else setError(r.error);
    });
  };
  return { pending, error, done, onSubmit };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Icon and tone for each kind, drawn as a small badge on the avatar. */
const KIND: Record<string, { icon: ReactNode; tone: Tone; label: string }> = {
  verification: { icon: <CheckCircle2 className="h-2.5 w-2.5" />, tone: "ok", label: "Verified" },
  note: { icon: <StickyNote className="h-2.5 w-2.5" />, tone: "neutral", label: "Note" },
  question: { icon: <MessageCircleQuestion className="h-2.5 w-2.5" />, tone: "accent", label: "Question" },
  attachment: { icon: <Paperclip className="h-2.5 w-2.5" />, tone: "neutral", label: "Attachment" },
  adjustment: { icon: <PencilLine className="h-2.5 w-2.5" />, tone: "accent", label: "Adjustment" },
  judgment: { icon: <Gavel className="h-2.5 w-2.5" />, tone: "ok", label: "Judgment" },
  disposition: { icon: <FileCheck2 className="h-2.5 w-2.5" />, tone: "neutral", label: "Disposition" },
  step: { icon: <ListChecks className="h-2.5 w-2.5" />, tone: "neutral", label: "Step" },
  signoff: { icon: <UserCheck className="h-2.5 w-2.5" />, tone: "ok", label: "Sign-off" },
  assignment: { icon: <UserCheck className="h-2.5 w-2.5" />, tone: "neutral", label: "Assignment" },
  approval_request: { icon: <Send className="h-2.5 w-2.5" />, tone: "accent", label: "Sent for approval" },
  approval: { icon: <FileSignature className="h-2.5 w-2.5" />, tone: "ok", label: "Client approval" },
};

const TONE_BG: Record<Tone, string> = {
  neutral: "bg-surface-3 text-muted",
  accent: "bg-accent text-accent-fg",
  ok: "bg-ok text-white",
  warn: "bg-warn text-white",
  danger: "bg-danger text-white",
};

function Feedback({ error, done, doneText = "Recorded" }: { error: string | null; done: boolean; doneText?: string }) {
  if (error)
    return (
      <span className="flex items-center gap-1 text-[12px] text-danger" role="alert">
        <AlertTriangle className="h-3.5 w-3.5" /> {error}
      </span>
    );
  if (done)
    return (
      <span className="flex items-center gap-1 text-[12px] text-ok" role="status">
        <CheckCircle2 className="h-3.5 w-3.5" /> {doneText}
      </span>
    );
  return null;
}

/**
 * The evidence and review trail for one target, with the forms to add to it.
 * Used on lines, documents, values, findings and records alike.
 */
export function FactsPanel({
  target,
  facts,
  actor,
  staff,
  verificationTypes,
  title = "Evidence and review",
  compact,
}: {
  target: string;
  facts: FactView[];
  actor: ActorLite;
  staff: StaffOption[];
  verificationTypes: string[];
  title?: string;
  compact?: boolean;
}) {
  const allTabs: { key: Tab; label: string; icon: ReactNode; allowed: boolean }[] = [
    { key: "verify", label: "Verify", icon: <CheckCircle2 className="h-3.5 w-3.5" />, allowed: canVerify(actor) },
    { key: "note", label: "Note", icon: <StickyNote className="h-3.5 w-3.5" />, allowed: canNote(actor) },
    { key: "ask", label: "Ask", icon: <MessageCircleQuestion className="h-3.5 w-3.5" />, allowed: canAsk(actor) },
    { key: "attach", label: "Attach", icon: <Paperclip className="h-3.5 w-3.5" />, allowed: canAttach(actor) },
  ];
  const tabs = allTabs.filter((t) => t.allowed);
  const [tab, setTab] = useState<Tab | null>(null);
  const [showAll, setShowAll] = useState(false);

  const live = facts.filter((f) => !f.retracted);
  const verified = live.filter((f) => f.kind === "verification").length;
  const openQuestions = live.filter((f) => f.kind === "question" && f.answers.every((a) => a.retracted)).length;
  const openNotes = live.filter((f) => f.kind === "note" && !f.resolved).length;
  const blocking = live.filter((f) => f.kind === "note" && !f.resolved && f.body.blocking === true).length;
  const shown = showAll ? facts : facts.slice(0, SHOW_FIRST);
  const hidden = facts.length - shown.length;

  return (
    <section className="card overflow-hidden">
      <header className={cn("flex flex-wrap items-center justify-between gap-2 px-5 pt-4", compact ? "pb-2" : "pb-3")}>
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h2>
          {facts.length ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted">
              {verified ? (
                <span className="flex items-center gap-1 text-ok">
                  <CheckCircle2 className="h-3 w-3" /> {verified} verification{verified === 1 ? "" : "s"}
                </span>
              ) : null}
              {blocking ? (
                <span className="flex items-center gap-1 text-danger">
                  <OctagonAlert className="h-3 w-3" /> {blocking} blocking
                </span>
              ) : null}
              {openNotes - blocking > 0 ? <span>{openNotes - blocking} open note{openNotes - blocking === 1 ? "" : "s"}</span> : null}
              {openQuestions ? (
                <span className="flex items-center gap-1 text-accent">
                  <MessageCircleQuestion className="h-3 w-3" /> {openQuestions} awaiting answer
                </span>
              ) : null}
              <span>
                {facts.length} record{facts.length === 1 ? "" : "s"}
              </span>
            </div>
          ) : null}
        </div>
        <span className="ref pointer-events-none max-w-full truncate">{target}</span>
      </header>

      {/* Composer: one row of actions, the chosen form opens beneath. */}
      {tabs.length ? (
        <div className={cn("border-y border-border bg-surface-2/30", tab ? "px-5 py-4" : "px-5 py-2.5")}>
          <div className="flex flex-wrap items-center gap-1.5">
            {tabs.map((t) => (
              <button key={t.key} type="button" onClick={() => setTab(tab === t.key ? null : t.key)} aria-expanded={tab === t.key} className={cn("chip", tab === t.key && "is-active")}>
                {t.icon}
                {t.label}
              </button>
            ))}
            {tab ? (
              <button type="button" onClick={() => setTab(null)} className="icon-btn ml-auto h-7 w-7" aria-label="Close the form">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="ml-auto hidden text-[11.5px] text-muted sm:inline">Everything added here is permanent and attributed.</span>
            )}
          </div>
          {tab ? (
            <div className="mt-3">
              {tab === "verify" ? <VerifyForm target={target} types={verificationTypes} onDone={() => setTab(null)} /> : null}
              {tab === "note" ? <NoteForm target={target} canBlock={canBlock(actor)} onDone={() => setTab(null)} /> : null}
              {tab === "ask" ? <AskForm target={target} staff={staff} actor={actor} onDone={() => setTab(null)} /> : null}
              {tab === "attach" ? <AttachForm target={target} onDone={() => setTab(null)} /> : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="border-y border-border" />
      )}

      {/* The trail, newest first. */}
      {facts.length === 0 ? (
        <div className="flex items-start gap-3 px-5 py-5 text-[12.5px] leading-5 text-muted">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted ring-1 ring-inset ring-border">
            <StickyNote className="h-3.5 w-3.5" />
          </span>
          <span>Nothing recorded on this item yet. {tabs.length ? "Verify it, leave a note, ask a question or attach a file above; the record keeps who, when and why." : "Staff verify, note, ask and attach here; the record keeps who, when and why."}</span>
        </div>
      ) : (
        <>
          <ol className="px-5">
            {shown.map((f, i) => (
              <FactItem key={f.id} f={f} actor={actor} staff={staff} last={i === shown.length - 1 && hidden === 0} />
            ))}
          </ol>
          {hidden > 0 ? (
            <button type="button" onClick={() => setShowAll(true)} className="flex w-full items-center justify-center gap-1.5 border-t border-border px-5 py-2.5 text-[12px] font-medium text-muted hover:bg-surface-2/60 hover:text-foreground">
              <ChevronDown className="h-3.5 w-3.5" /> {hidden} earlier record{hidden === 1 ? "" : "s"}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

function FactItem({ f, actor, staff, last }: { f: FactView; actor: ActorLite; staff: StaffOption[]; last: boolean }) {
  const retract = useSubmit(retractAction);
  const resolve = useSubmit(resolveAction);
  const [answering, setAnswering] = useState(false);
  const answer = useSubmit(answerAction, () => setAnswering(false));
  const role = f.actorRole === "unknown" ? "" : ROLE_LABELS[f.actorRole];
  const to = typeof f.body.to === "string" ? f.body.to : "";
  const toName = to === "client" ? "the client" : (staff.find((s) => s.id === to)?.name ?? to);
  const openQuestion = f.kind === "question" && f.answers.filter((a) => !a.retracted).length === 0;
  const kind = KIND[f.kind] ?? { icon: <StickyNote className="h-2.5 w-2.5" />, tone: "neutral" as Tone, label: humanize(f.kind) };
  const isClient = f.actorRole === "client";
  const text = typeof f.body.text === "string" ? f.body.text : "";

  return (
    <li className={cn("group relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 py-3", f.retracted && "opacity-60")}>
      {!last ? <span className="absolute bottom-0 left-[13.5px] top-10 w-px bg-border" aria-hidden /> : null}
      <span className="relative mt-0.5">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-surface", isClient ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent")} title={f.actorName}>
          {initials(f.actorName)}
        </span>
        <span className={cn("absolute -bottom-0.5 -right-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-surface", TONE_BG[kind.tone])} title={kind.label}>
          {kind.icon}
        </span>
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px] leading-4">
          <span className="font-medium text-foreground">{f.actorName}</span>
          {role ? <span className="text-muted">{role}</span> : null}
          <time className="text-muted" dateTime={f.at} title={f.at}>
            {fmtWhen.format(new Date(f.at))}
          </time>
          {f.retracted ? <Badge tone="neutral">retracted</Badge> : null}
          {!f.retracted ? (
            <span className="ml-auto flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              {f.kind === "note" && !f.resolved && canResolve(actor, f.actorId) ? (
                <form onSubmit={resolve.onSubmit}>
                  <input type="hidden" name="factId" value={f.id} />
                  <button type="submit" disabled={resolve.pending} className="pill h-6 px-2 text-[11px]">
                    <CheckCircle2 className="h-3 w-3" /> Resolve
                  </button>
                </form>
              ) : null}
              {openQuestion && canAnswer(actor, to) ? (
                <button type="button" onClick={() => setAnswering((v) => !v)} className={cn("pill h-6 px-2 text-[11px]", answering && "is-active")}>
                  {answering ? "Cancel" : "Answer"}
                </button>
              ) : null}
              {canRetract(actor, f.actorId) ? (
                <form
                  onSubmit={(e) => {
                    if (!confirm("Retract this record? It stays in the history, marked as retracted.")) {
                      e.preventDefault();
                      return;
                    }
                    retract.onSubmit(e);
                  }}
                >
                  <input type="hidden" name="factId" value={f.id} />
                  <button type="submit" disabled={retract.pending} className="icon-btn h-6 w-6" title="Retract this record" aria-label="Retract this record">
                    <Undo2 className="h-3 w-3" />
                  </button>
                </form>
              ) : null}
            </span>
          ) : null}
        </div>

        <div className={cn("mt-1 text-[13px] leading-5", f.retracted && "line-through")}>
          {f.kind === "verification" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="ok">
                <CheckCircle2 className="h-3 w-3" /> {humanize(String(f.body.type ?? ""))}
              </Badge>
              {typeof f.body.note === "string" && f.body.note ? <span className="text-muted">{f.body.note}</span> : null}
            </div>
          ) : null}

          {f.kind === "note" ? (
            <div>
              {f.body.blocking === true || f.resolved ? (
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  {f.body.blocking === true ? (
                    <Badge tone={f.resolved ? "neutral" : "danger"}>
                      <OctagonAlert className="h-3 w-3" /> {f.resolved ? "was blocking" : "blocks filing"}
                    </Badge>
                  ) : null}
                  {f.resolved ? <Badge tone="ok">resolved</Badge> : null}
                </div>
              ) : null}
              <p className={cn("whitespace-pre-wrap break-words", f.resolved && "text-muted")}>{text}</p>
            </div>
          ) : null}

          {f.kind === "question" ? (
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <Badge tone={openQuestion ? "accent" : "ok"} dot={openQuestion}>
                  {openQuestion ? "waiting on " + toName : "answered"}
                </Badge>
                {!openQuestion ? <span className="text-[11.5px] text-muted">asked {toName}</span> : null}
              </div>
              <p className="whitespace-pre-wrap break-words">{text}</p>
              {f.answers.length ? (
                <ul className="mt-2 grid gap-2">
                  {f.answers.map((a) => (
                    <li key={a.id} className={cn("rounded-lg border border-border bg-surface-2/40 px-3 py-2", a.retracted && "line-through opacity-60")}>
                      <div className="flex flex-wrap items-baseline gap-x-2 text-[11.5px] text-muted">
                        <span className="font-medium text-foreground">{a.actorName}</span>
                        {a.body.onBehalf === true ? <span>recorded for the client</span> : null}
                        <time dateTime={a.at}>{fmtWhen.format(new Date(a.at))}</time>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-[12.5px]">{String(a.body.text ?? "")}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {f.kind === "adjustment" ? (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12.5px] tabular-nums">
                  <span className="text-muted line-through">{numFmt(f.body.engineValue)}</span> → <span className="font-semibold">{numFmt(f.body.newValue)}</span> <span className="text-muted">({signed(f.body.delta)})</span>
                </span>
                <EffectText effect={f.body.effect} />
                {f.body.requiresPartner === true ? <Badge tone="warn">needs partner approval</Badge> : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words">{String(f.body.reason ?? "")}</p>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11.5px] text-muted">
                {typeof f.body.authority === "string" && f.body.authority ? <span>Authority: {f.body.authority}</span> : null}
                {typeof f.body.fromFinding === "string" ? (
                  <Link href={hrefFor(f.body.fromFinding)} className="text-accent hover:underline">
                    from a check finding
                  </Link>
                ) : null}
                {typeof f.body.whatIf === "string" ? <span>what-if {f.body.whatIf}</span> : null}
                <span>based on {String(f.body.basedOn ?? "")}</span>
              </div>
            </div>
          ) : null}

          {f.kind === "judgment" ? (
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <Badge tone="ok">{JUDGMENT_LABELS[f.body.type as JudgmentType] ?? "Judgment"}</Badge>
                {typeof f.body.choice === "string" ? <span className="text-[11.5px] text-muted">chose {f.body.choice}</span> : null}
                {typeof f.body.status === "string" ? <Badge tone="accent">{f.body.status.replace(/_/g, " ")}</Badge> : null}
              </div>
              <p className="whitespace-pre-wrap break-words">{text}</p>
              {typeof f.body.authority === "string" && f.body.authority ? <p className="mt-0.5 text-[11.5px] text-muted">Authority: {f.body.authority}</p> : null}
            </div>
          ) : null}

          {f.kind === "disposition" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{DISPOSITION_LABELS[f.body.disposition as Disposition] ?? String(f.body.disposition)}</Badge>
              {text ? <span className="text-muted">{text}</span> : null}
            </div>
          ) : null}

          {f.kind === "step" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={f.body.done === true ? "ok" : "warn"}>{f.body.done === true ? "step completed" : "step reopened"}</Badge>
              {text ? <span className="text-muted">{text}</span> : null}
            </div>
          ) : null}

          {f.kind === "signoff" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="ok">signed off at the {String(f.body.level ?? "")} level</Badge>
              <span className="font-mono text-[11px] text-muted" title="Fingerprint of the return as signed">
                {String(f.body.hash ?? "").slice(0, 12)}
              </span>
              {text ? <span className="text-muted">{text}</span> : null}
            </div>
          ) : null}

          {f.kind === "assignment" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{String(f.body.role ?? "")}</Badge>
              <span>{staff.find((s) => s.id === f.body.assigneeId)?.name ?? String(f.body.assigneeId ?? "")}</span>
              {typeof f.body.due === "string" ? <span className="text-muted">due {f.body.due}</span> : null}
              {text ? <span className="text-muted">{text}</span> : null}
            </div>
          ) : null}

          {f.kind === "approval_request" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">sent to the client for approval</Badge>
              {typeof f.body.message === "string" && f.body.message ? <span className="text-muted">&ldquo;{f.body.message}&rdquo;</span> : null}
            </div>
          ) : null}

          {f.kind === "approval" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="ok">approved and signed</Badge>
              <span className="text-muted">
                as {String(f.body.signerName ?? "")} · PIN ···{String(f.body.pinHint ?? "")} · {String(f.body.version ?? "")}
              </span>
            </div>
          ) : null}

          {f.kind === "attachment" ? (
            <div className="flex flex-wrap items-center gap-2">
              <a href={"/api/blobs/" + String(f.body.blobId)} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[12.5px] hover:border-accent hover:text-accent">
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{String(f.body.name ?? "file")}</span>
                <span className="shrink-0 text-[11px] text-muted">{fmtBytes(Number(f.body.size ?? 0))}</span>
              </a>
              {typeof f.body.note === "string" && f.body.note ? <span className="text-muted">{f.body.note}</span> : null}
            </div>
          ) : null}

          {!KIND[f.kind] ? <span className="text-muted">{humanize(f.kind)}</span> : null}
        </div>

        {retract.error || resolve.error ? (
          <div className="mt-1">
            <Feedback error={retract.error ?? resolve.error} done={false} />
          </div>
        ) : null}

        {answering ? (
          <form onSubmit={answer.onSubmit} className="mt-2 grid gap-2 rounded-lg border border-accent/30 bg-accent-soft/20 p-3">
            <input type="hidden" name="questionId" value={f.id} />
            <textarea name="text" rows={2} required autoFocus placeholder={actor.kind === "staff" && to === "client" ? "What the client said, in their words" : "Your answer"} className="input min-h-[56px] resize-y py-2 text-[13px]" />
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" disabled={answer.pending} className="pill primary h-7 text-[12px]">
                <Send className="h-3 w-3" /> {answer.pending ? "Sending…" : actor.kind === "staff" && to === "client" ? "Record the client's answer" : "Send answer"}
              </button>
              <button type="button" onClick={() => setAnswering(false)} className="pill h-7 text-[12px]">
                Cancel
              </button>
              <Feedback error={answer.error} done={answer.done} doneText="Answered" />
            </div>
          </form>
        ) : null}
      </div>
    </li>
  );
}

function VerifyForm({ target, types, onDone }: { target: string; types: string[]; onDone: () => void }) {
  const { pending, error, done, onSubmit } = useSubmit(verifyAction, onDone);
  return (
    <form onSubmit={onSubmit} className="grid gap-2.5">
      <input type="hidden" name="target" value={target} />
      <div>
        <div className="mb-1.5 text-[11.5px] text-muted">How was it verified?</div>
        <div className="flex flex-wrap gap-1.5">
          {types.map((t, i) => (
            <label key={t} className="cursor-pointer">
              <input type="radio" name="type" value={t} defaultChecked={i === 0} className="peer sr-only" />
              <span className="chip peer-checked:border-accent/50 peer-checked:bg-accent-soft peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40">{humanize(t)}</span>
            </label>
          ))}
        </div>
      </div>
      <input name="note" placeholder="Optional: what you compared, or a reference" className="input" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={cn("pill primary", pending && "opacity-50")}>
          <CheckCircle2 className="h-3.5 w-3.5" /> {pending ? "Recording…" : "Record verification"}
        </button>
        <Feedback error={error} done={done} doneText="Verified" />
      </div>
    </form>
  );
}

function NoteForm({ target, canBlock, onDone }: { target: string; canBlock: boolean; onDone: () => void }) {
  const { pending, error, done, onSubmit } = useSubmit(noteAction, onDone);
  return (
    <form onSubmit={onSubmit} className="grid gap-2.5">
      <input type="hidden" name="target" value={target} />
      <textarea name="text" rows={3} required autoFocus placeholder="What should the next reader know?" className="input min-h-[72px] resize-y py-2 text-[13px]" />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={cn("pill primary", pending && "opacity-50")}>
          <StickyNote className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Add note"}
        </button>
        {canBlock ? (
          <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
            <input type="checkbox" name="blocking" className="h-3.5 w-3.5 accent-[var(--danger)]" /> Blocks filing until resolved
          </label>
        ) : null}
        <Feedback error={error} done={done} doneText="Note added" />
      </div>
    </form>
  );
}

function AskForm({ target, staff, actor, onDone }: { target: string; staff: StaffOption[]; actor: ActorLite; onDone: () => void }) {
  const { pending, error, done, onSubmit } = useSubmit(askAction, onDone);
  return (
    <form onSubmit={onSubmit} className="grid gap-2.5">
      <input type="hidden" name="target" value={target} />
      <textarea name="text" rows={3} required autoFocus placeholder="Ask the client or a colleague. The answer becomes evidence on this item." className="input min-h-[72px] resize-y py-2 text-[13px]" />
      <div className="flex flex-wrap items-center gap-2">
        <select name="to" defaultValue="client" className="input w-auto" aria-label="Who to ask">
          <option value="client">To the client</option>
          {staff
            .filter((s) => s.id !== actor.id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                To {s.name}
              </option>
            ))}
        </select>
        <button type="submit" disabled={pending} className={cn("pill primary", pending && "opacity-50")}>
          <Send className="h-3.5 w-3.5" /> {pending ? "Sending…" : "Send question"}
        </button>
        <Feedback error={error} done={done} doneText="Sent" />
      </div>
    </form>
  );
}

function AttachForm({ target, onDone }: { target: string; onDone: () => void }) {
  const { pending, error, done, onSubmit } = useSubmit(attachAction, onDone);
  return (
    <form onSubmit={onSubmit} className="grid gap-2.5">
      <input type="hidden" name="target" value={target} />
      <input type="file" name="file" required className="text-[12.5px] file:mr-3 file:rounded-full file:border file:border-border file:bg-surface file:px-3 file:py-1 file:text-[12px] file:font-medium file:text-foreground" />
      <input name="note" placeholder="Optional: what this file shows" className="input" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={cn("pill primary", pending && "opacity-50")}>
          <Paperclip className="h-3.5 w-3.5" /> {pending ? "Uploading…" : "Attach as evidence"}
        </button>
        <span className="text-[11px] text-muted">Up to 5 MB</span>
        <Feedback error={error} done={done} doneText="Attached" />
      </div>
    </form>
  );
}

const numFmt = (v: unknown) => (typeof v === "number" ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v) : String(v ?? ""));
const signed = (v: unknown) => (typeof v === "number" ? (v > 0 ? "+" : "") + numFmt(v) : "");

function EffectText({ effect }: { effect: unknown }) {
  if (!effect || typeof effect !== "object") return null;
  const e = effect as { federal?: number; california?: number };
  const fed = e.federal ?? 0;
  const ca = e.california ?? 0;
  if (!fed && !ca) return null;
  const part = (n: number, label: string) => (n ? (n > 0 ? "+" : "−") + numFmt(Math.abs(n)) + " " + label : null);
  return (
    <Badge tone={fed + ca > 0 ? "warn" : "ok"} title="Estimated change in balance due if this stands">
      {[part(fed, "fed"), part(ca, "CA")].filter(Boolean).join(" · ")}
    </Badge>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}
