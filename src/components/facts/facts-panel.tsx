"use client";

import { CheckCircle2, MessageCircleQuestion, OctagonAlert, Paperclip, PencilLine, StickyNote, Undo2 } from "lucide-react";
import Link from "next/link";
import { hrefFor } from "@/lib/refs";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { humanize } from "@/components/facts/fact-marks";
import { Badge, cn, Empty } from "@/components/ui";
import {
  answerAction,
  askAction,
  attachAction,
  noteAction,
  resolveAction,
  retractAction,
  verifyAction,
  type ActionResult,
} from "@/lib/facts/actions";
import type { FactView } from "@/lib/facts/types";
import { canAnswer, canAsk, canAttach, canBlock, canNote, canResolve, canRetract, canVerify, type ActorLite } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";

export interface StaffOption {
  id: string;
  name: string;
}

type Tab = "verify" | "note" | "ask" | "attach";

const fmtWhen = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

function useSubmit(action: (fd: FormData) => Promise<ActionResult>) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      setError(null);
      const r = await action(fd);
      if (r.ok) form.reset();
      else setError(r.error);
    });
  };
  return { pending, error, onSubmit };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const input = "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-accent";
const button = "rounded-full bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-fg disabled:opacity-50";
const ghost = "rounded-full border border-border px-2.5 py-1 text-[12px] text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-50";

/**
 * The evidence and review trail for one target, with the forms to add to it.
 * Used on lines, documents and extracted values alike.
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
  const [tab, setTab] = useState<Tab>(tabs[0]?.key ?? "attach");

  return (
    <section className={cn("card", compact ? "" : "")}>
      <header className="flex items-center justify-between px-4 pb-2 pt-3.5">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        <span className="font-mono text-[11px] text-muted">{target}</span>
      </header>

      <div className="px-4 pb-3">
        {facts.length === 0 ? (
          <Empty>Nothing recorded yet. Whatever you add here becomes part of the permanent record.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {facts.map((f) => (
              <FactItem key={f.id} f={f} actor={actor} staff={staff} />
            ))}
          </ul>
        )}
      </div>

      {tabs.length ? (
        <div className="border-t border-border px-4 py-3">
          <div className="mb-2.5 flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
                  tab === t.key ? "bg-accent-soft text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          {tab === "verify" ? <VerifyForm target={target} types={verificationTypes} /> : null}
          {tab === "note" ? <NoteForm target={target} canBlock={canBlock(actor)} /> : null}
          {tab === "ask" ? <AskForm target={target} staff={staff} actor={actor} /> : null}
          {tab === "attach" ? <AttachForm target={target} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function FactItem({ f, actor, staff }: { f: FactView; actor: ActorLite; staff: StaffOption[] }) {
  const retract = useSubmit(retractAction);
  const resolve = useSubmit(resolveAction);
  const answer = useSubmit(answerAction);
  const [answering, setAnswering] = useState(false);
  const role = f.actorRole === "unknown" ? "" : ROLE_LABELS[f.actorRole];
  const to = typeof f.body.to === "string" ? f.body.to : "";
  const toName = to === "client" ? "the client" : (staff.find((s) => s.id === to)?.name ?? to);
  const openQuestion = f.kind === "question" && f.answers.filter((a) => !a.retracted).length === 0;

  return (
    <li className={cn("py-2.5", f.retracted && "opacity-60")}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-muted">
          {initials(f.actorName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
            <span className="font-medium text-foreground">{f.actorName}</span>
            <span className="text-muted">{role}</span>
            <span className="text-muted">·</span>
            <time className="text-muted" dateTime={f.at}>
              {fmtWhen.format(new Date(f.at))}
            </time>
            {f.retracted ? <Badge tone="neutral">retracted</Badge> : null}
          </div>

          <div className="mt-1 text-[13px]">
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
                <div className="flex flex-wrap items-center gap-2">
                  {f.body.blocking === true ? (
                    <Badge tone={f.resolved ? "neutral" : "danger"}>
                      <OctagonAlert className="h-3 w-3" /> {f.resolved ? "was blocking" : "blocks filing"}
                    </Badge>
                  ) : null}
                  {f.resolved ? <Badge tone="ok">resolved</Badge> : null}
                </div>
                <p className={cn("mt-1 whitespace-pre-wrap", f.resolved && "text-muted")}>{String(f.body.text ?? "")}</p>
              </div>
            ) : null}
            {f.kind === "question" ? (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={openQuestion ? "accent" : "ok"}>
                    <MessageCircleQuestion className="h-3 w-3" /> {openQuestion ? "waiting on " + toName : "answered"}
                  </Badge>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{String(f.body.text ?? "")}</p>
                {f.answers.length ? (
                  <ul className="mt-2 grid gap-1.5 border-l-2 border-border pl-3">
                    {f.answers.map((a) => (
                      <li key={a.id} className={cn(a.retracted && "line-through opacity-60")}>
                        <span className="text-[12px] text-muted">
                          {a.actorName}
                          {a.body.onBehalf === true ? " (recorded for the client)" : ""} · {fmtWhen.format(new Date(a.at))}
                        </span>
                        <p className="whitespace-pre-wrap">{String(a.body.text ?? "")}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {f.kind === "adjustment" ? (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">
                    <PencilLine className="h-3 w-3" /> adjusted
                  </Badge>
                  <span className="font-mono text-[12px] tabular-nums">
                    <span className="text-muted line-through">{numFmt(f.body.engineValue)}</span> → <span className="font-semibold">{numFmt(f.body.newValue)}</span>{" "}
                    <span className="text-muted">({signed(f.body.delta)})</span>
                  </span>
                  <EffectText effect={f.body.effect} />
                  {f.body.requiresPartner === true ? <Badge tone="warn">needs partner sign-off</Badge> : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap">{String(f.body.reason ?? "")}</p>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-muted">
                  {typeof f.body.authority === "string" && f.body.authority ? <span>Authority: {f.body.authority}</span> : null}
                  {typeof f.body.fromFinding === "string" ? (
                    <Link href={hrefFor(f.body.fromFinding)} className="text-accent hover:underline">
                      from check finding
                    </Link>
                  ) : null}
                  {typeof f.body.whatIf === "string" ? <span>what-if {f.body.whatIf}</span> : null}
                  <span>based on {String(f.body.basedOn ?? "")}</span>
                </div>
              </div>
            ) : null}
            {f.kind === "attachment" ? (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={"/api/blobs/" + String(f.body.blobId)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  <Paperclip className="h-3.5 w-3.5" /> {String(f.body.name ?? "file")}
                </a>
                <span className="text-[12px] text-muted">{fmtBytes(Number(f.body.size ?? 0))}</span>
                {typeof f.body.note === "string" && f.body.note ? <span className="text-muted">{f.body.note}</span> : null}
              </div>
            ) : null}
          </div>

          {!f.retracted ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {f.kind === "note" && !f.resolved && canResolve(actor, f.actorId) ? (
                <form onSubmit={resolve.onSubmit}>
                  <input type="hidden" name="factId" value={f.id} />
                  <button type="submit" disabled={resolve.pending} className={ghost}>
                    Resolve
                  </button>
                </form>
              ) : null}
              {openQuestion && canAnswer(actor, to) ? (
                <button type="button" onClick={() => setAnswering((v) => !v)} className={ghost}>
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
                  <button type="submit" disabled={retract.pending} className={ghost} title="Retract">
                    <Undo2 className="h-3 w-3" />
                  </button>
                </form>
              ) : null}
              {retract.error || resolve.error ? <span className="text-[12px] text-danger">{retract.error ?? resolve.error}</span> : null}
            </div>
          ) : null}

          {answering ? (
            <form onSubmit={answer.onSubmit} className="mt-2 grid gap-2">
              <input type="hidden" name="questionId" value={f.id} />
              <textarea name="text" rows={2} required placeholder="Your answer" className={input} />
              <div className="flex items-center gap-2">
                <button type="submit" disabled={answer.pending} className={button}>
                  {actor.kind === "staff" && to === "client" ? "Record client's answer" : "Send answer"}
                </button>
                {answer.error ? <span className="text-[12px] text-danger">{answer.error}</span> : null}
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function VerifyForm({ target, types }: { target: string; types: string[] }) {
  const { pending, error, onSubmit } = useSubmit(verifyAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-2">
      <input type="hidden" name="target" value={target} />
      <div className="flex flex-wrap gap-1.5">
        {types.map((t, i) => (
          <label key={t} className="cursor-pointer">
            <input type="radio" name="type" value={t} defaultChecked={i === 0} className="peer sr-only" />
            <span className="inline-block rounded-full border border-border px-2.5 py-1 text-[12px] text-muted peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-foreground">
              {humanize(t)}
            </span>
          </label>
        ))}
      </div>
      <input name="note" placeholder="Optional: what you compared, or a reference" className={input} />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={button}>
          Record verification
        </button>
        {error ? <span className="text-[12px] text-danger">{error}</span> : null}
      </div>
    </form>
  );
}

function NoteForm({ target, canBlock }: { target: string; canBlock: boolean }) {
  const { pending, error, onSubmit } = useSubmit(noteAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-2">
      <input type="hidden" name="target" value={target} />
      <textarea name="text" rows={3} required placeholder="What should the next reader know?" className={input} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={button}>
          Add note
        </button>
        {canBlock ? (
          <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
            <input type="checkbox" name="blocking" className="accent-[var(--danger)]" /> Blocks filing until resolved
          </label>
        ) : null}
        {error ? <span className="text-[12px] text-danger">{error}</span> : null}
      </div>
    </form>
  );
}

function AskForm({ target, staff, actor }: { target: string; staff: StaffOption[]; actor: ActorLite }) {
  const { pending, error, onSubmit } = useSubmit(askAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-2">
      <input type="hidden" name="target" value={target} />
      <textarea name="text" rows={3} required placeholder="Ask the client or a colleague. Their answer becomes evidence on this item." className={input} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="to" defaultValue="client" className={cn(input, "w-auto")}>
          <option value="client">To the client</option>
          {staff
            .filter((s) => s.id !== actor.id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                To {s.name}
              </option>
            ))}
        </select>
        <button type="submit" disabled={pending} className={button}>
          Send question
        </button>
        {error ? <span className="text-[12px] text-danger">{error}</span> : null}
      </div>
    </form>
  );
}

function AttachForm({ target }: { target: string }) {
  const { pending, error, onSubmit } = useSubmit(attachAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-2">
      <input type="hidden" name="target" value={target} />
      <input type="file" name="file" required className="text-[12.5px] file:mr-3 file:rounded-full file:border file:border-border file:bg-surface file:px-3 file:py-1 file:text-[12px] file:text-foreground" />
      <input name="note" placeholder="Optional: what this file shows" className={input} />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={button}>
          Attach as evidence
        </button>
        <span className="text-[11px] text-muted">Up to 5 MB</span>
        {error ? <span className="text-[12px] text-danger">{error}</span> : null}
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
