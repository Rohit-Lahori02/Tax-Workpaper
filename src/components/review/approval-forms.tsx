"use client";

import { FileSignature, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "@/components/ui";
import { clientApproveAction, requestApprovalAction } from "@/lib/facts/actions-review";

const input = "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-accent";

export function RequestApprovalForm({ allowed, resend }: { allowed: boolean; resend: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
          setError(r.ok ? null : r.error);
        });
      }}
    >
      <textarea name="message" rows={2} placeholder="Message to the client (optional)" className={input} />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={cn("pill primary", pending && "opacity-50")}>
          <Send className="h-3.5 w-3.5" /> {resend ? "Send the updated return for approval" : "Send to client for approval"}
        </button>
        {error ? <span className="text-[12px] text-danger">{error}</span> : null}
      </div>
    </form>
  );
}

export function ClientApprovalForm({ defaultName, federal, california }: { defaultName: string; federal: string; california: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          setError(null);
          const r = await clientApproveAction(fd);
          if (r.ok) {
            setDoneMsg("Signed. Thank you.");
            form.reset();
          } else setError(r.error);
        });
      }}
    >
      <label className="grid gap-1 text-[12px] text-muted">
        Type your full name as your signature
        <input name="signerName" defaultValue={defaultName} required minLength={2} className={cn(input, "text-foreground")} />
      </label>
      <label className="grid gap-1 text-[12px] text-muted">
        Choose any 5-digit PIN (your e-file signature; only the last two digits are kept here)
        <input name="pin" inputMode="numeric" pattern="\d{5}" maxLength={5} required className={cn(input, "w-32 font-mono text-foreground")} />
      </label>
      <label className="flex items-start gap-2 text-[12.5px]">
        <input type="checkbox" name="consent" required className="mt-0.5 accent-[var(--accent)]" />
        <span>
          I have reviewed the return shown here, including the federal balance of <strong>{federal}</strong> and the California balance of <strong>{california}</strong>. I declare it is true, correct and complete to the best of my knowledge, and I authorize
          Miraflores to e-file it (IRS Form 8879 and FTB 8879).
        </span>
      </label>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={cn("pill primary", pending && "opacity-50")}>
          <FileSignature className="h-3.5 w-3.5" /> Approve and sign
        </button>
        {error ? <span className="text-[12px] text-danger">{error}</span> : null}
        {doneMsg ? <span className="text-[12px] text-ok">{doneMsg}</span> : null}
      </div>
    </form>
  );
}
