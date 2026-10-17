"use client";

import { CheckCircle2, FileSignature, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "@/components/ui";
import { clientApproveAction, requestApprovalAction } from "@/lib/facts/actions-review";

export function RequestApprovalForm({ allowed, resend, ready }: { allowed: boolean; resend: boolean; ready: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  if (!allowed) return null;
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setError(null);
          const r = await requestApprovalAction(fd);
          if (r.ok) setSent(true);
          else setError(r.error);
        });
      }}
    >
      <textarea name="message" rows={2} placeholder="A note for the client (optional): what changed, what to look at, when you need it back" className="input min-h-[60px] resize-y py-2 text-[13px]" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending || !ready} className={cn("pill primary", (pending || !ready) && "cursor-not-allowed opacity-50")} title={ready ? undefined : "Every prerequisite above must be met first"}>
          <Send className="h-3.5 w-3.5" /> {resend ? "Send the updated return for approval" : "Send to the client for approval"}
        </button>
        {error ? <span className="text-[12px] text-danger">{error}</span> : null}
        {sent ? (
          <span className="flex items-center gap-1 text-[12px] text-ok">
            <CheckCircle2 className="h-3.5 w-3.5" /> Sent. The client sees it under Client approval and in their work list.
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function ClientApprovalForm({ defaultName, federal, california }: { defaultName: string; federal: string; california: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-ok/30 bg-ok-soft px-4 py-3 text-[13px] text-ok">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Signed. Thank you. Your preparer can now file once every signature is in.</span>
      </div>
    );
  }
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setError(null);
          const r = await clientApproveAction(fd);
          if (r.ok) setDone(true);
          else setError(r.error);
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-1 text-[12px] text-muted">
          Your full name, typed as your signature
          <input name="signerName" defaultValue={defaultName} required minLength={2} autoComplete="name" className="input h-10 text-[14px] text-foreground" />
        </label>
        <label className="grid gap-1 text-[12px] text-muted">
          Choose a 5-digit PIN
          <input name="pin" inputMode="numeric" pattern="\d{5}" maxLength={5} required autoComplete="off" placeholder="•••••" className="input h-10 w-32 font-mono text-[16px] tracking-[0.3em] text-foreground" />
        </label>
      </div>
      <p className="-mt-2 text-[11.5px] leading-4 text-muted">The PIN is your electronic signature for the IRS and California. Only its last two digits are kept in this file.</p>
      <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-2/40 px-4 py-3 text-[13px] leading-5">
        <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 accent-[var(--accent)]" />
        <span>
          I have reviewed the return shown here, including the federal balance of <strong>{federal}</strong> and the California balance of <strong>{california}</strong>. I declare it is true, correct and complete to the best of my knowledge, and I authorize Miraflores to e-file it
          (IRS Form 8879 and FTB 8879).
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={cn("pill primary h-9 px-4 text-[13px]", pending && "opacity-50")}>
          <FileSignature className="h-4 w-4" /> Approve and sign
        </button>
        {error ? <span className="text-[12px] text-danger">{error}</span> : null}
      </div>
    </form>
  );
}
