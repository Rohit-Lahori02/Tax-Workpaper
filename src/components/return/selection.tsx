"use client";

import { CheckCircle2, Undo2, X } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { cn } from "@/components/ui";
import { bulkVerifyAction, undoBatchAction } from "@/lib/facts/actions-adjust";

interface SelectionState {
  selected: Set<string>;
  toggle(key: string): void;
  setAll(keys: string[], on: boolean): void;
  clear(): void;
}

const Ctx = createContext<SelectionState | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const value = useMemo<SelectionState>(
    () => ({
      selected,
      toggle: (key) =>
        setSelected((s) => {
          const n = new Set(s);
          if (n.has(key)) n.delete(key);
          else n.add(key);
          return n;
        }),
      setAll: (keys, on) =>
        setSelected((s) => {
          const n = new Set(s);
          for (const k of keys) if (on) n.add(k);
          else n.delete(k);
          return n;
        }),
      clear: () => setSelected(new Set()),
    }),
    [selected],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useSelection() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("SelectionProvider missing");
  return ctx;
}

export function RowCheckbox({ lineKey }: { lineKey: string }) {
  const { selected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      aria-label={"Select " + lineKey}
      checked={selected.has(lineKey)}
      onChange={() => toggle(lineKey)}
      suppressHydrationWarning
      className="h-3.5 w-3.5 rounded accent-[var(--accent)]"
    />
  );
}

export function SelectAllCheckbox({ keys }: { keys: string[] }) {
  const { selected, setAll } = useSelection();
  const all = keys.length > 0 && keys.every((k) => selected.has(k));
  return (
    <input
      type="checkbox"
      aria-label="Select every line"
      checked={all}
      onChange={() => setAll(keys, !all)}
      suppressHydrationWarning
      className="h-3.5 w-3.5 accent-[var(--accent)]"
    />
  );
}

/** Floating bar for acting on many lines at once. After a batch, offers one-click undo. */
export function BulkBar({ verificationTypes, canVerify }: { verificationTypes: string[]; canVerify: boolean }) {
  const { selected, clear } = useSelection();
  const [type, setType] = useState(verificationTypes[0] ?? "");
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ text: string; batchId: string | null; error?: boolean } | null>(null);

  useEffect(() => {
    if (!toast || toast.error) return;
    const t = setTimeout(() => setToast(null), 12000);
    return () => clearTimeout(t);
  }, [toast]);

  const n = selected.size;
  if (n === 0 && !toast) return null;

  const verify = () => {
    const keys = [...selected];
    const fd = new FormData();
    fd.set("keys", JSON.stringify(keys));
    fd.set("type", type);
    start(async () => {
      const r = await bulkVerifyAction(fd);
      if (r.ok) {
        setToast({ text: "Verified " + keys.length + " line" + (keys.length === 1 ? "" : "s") + " as " + type.replace(/_/g, " "), batchId: r.id ?? null });
        clear();
      } else setToast({ text: r.error, batchId: null, error: true });
    });
  };
  const undo = (batchId: string) => {
    const fd = new FormData();
    fd.set("batchId", batchId);
    start(async () => {
      const r = await undoBatchAction(fd);
      setToast(r.ok ? { text: "Undone. The records stay in the history, marked retracted.", batchId: null } : { text: r.error, batchId: null, error: true });
    });
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
      <div className={cn("pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 text-[12.5px] shadow-[var(--shadow-pop)]", pending && "opacity-70")}>
        {n > 0 ? (
          <>
            <span className="rounded-md bg-accent-soft px-2 py-0.5 font-medium tabular-nums text-accent">{n} selected</span>
            {canVerify ? (
              <>
                <select value={type} onChange={(e) => setType(e.target.value)} className="h-8 rounded-lg border border-border bg-surface px-2 text-[12px]" aria-label="Verification type">
                  {verificationTypes.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={verify} disabled={pending} className="pill primary h-8">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verify all
                </button>
              </>
            ) : null}
            <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-muted hover:text-foreground" aria-label="Clear selection">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          </>
        ) : null}
        {toast ? (
          <span className={cn("inline-flex items-center gap-2", toast.error ? "text-danger" : "text-muted")}>
            {toast.text}
            {toast.batchId ? (
              <button type="button" onClick={() => undo(toast.batchId!)} disabled={pending} className="pill h-7 px-2.5 text-[12px]">
                <Undo2 className="h-3 w-3" /> Undo
              </button>
            ) : null}
            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="text-muted hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </span>
        ) : null}
      </div>
    </div>
  );
}
