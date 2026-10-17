"use client";

import { History, Play, X } from "lucide-react";
import { useTransition } from "react";
import { cn } from "@/components/ui";
import { setNowAction } from "@/lib/facts/actions-filing";

/** Moves the replay cursor to a moment. Viewing only; nothing is recorded. */
export function SetNowButton({ iso, label, active, className }: { iso: string; label?: string; active?: boolean; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending || active}
      onClick={() => start(async () => void (await setNowAction(iso)))}
      className={cn("inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted hover:border-border-strong hover:text-foreground disabled:opacity-50", active && "border-accent text-accent", className)}
      title={active ? "You are viewing the file as of this moment" : "View the file as it stood at this moment"}
    >
      <Play className="h-3 w-3" /> {label ?? "view as of"}
    </button>
  );
}

export function ClearNowButton({ className, label = "Back to now" }: { className?: string; label?: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => void (await setNowAction(null)))} className={cn("pill h-7 px-2.5 text-[12px]", className)}>
      <X className="h-3 w-3" /> {label}
    </button>
  );
}

/** The banner shown on every page while a replay cursor is set. */
export function ReplayBanner({ when }: { when: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-accent/30 bg-accent-soft px-6 py-1.5 text-[12.5px] text-foreground lg:px-8">
      <History className="h-3.5 w-3.5 text-accent" />
      <span>
        Replaying the file as of <strong className="font-semibold">{when}</strong>. Documents, versions and records after that moment are marked as not yet here.
      </span>
      <ClearNowButton className="ml-auto" />
    </div>
  );
}
