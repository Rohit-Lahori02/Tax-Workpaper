"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, PencilLine, ShieldAlert, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { RefLink } from "@/components/ref-link";
import { Badge, cn } from "@/components/ui";
import { CATEGORIES, CATEGORY_LABELS, effectFromRates, type EffectCategory, type RateTable } from "@/lib/effective";
import { adjustAction } from "@/lib/facts/actions-adjust";
import { fmtMoney, fmtNumber } from "@/lib/format";

export interface AdjustmentPrefill {
  newValue?: string;
  reason?: string;
  fromFinding?: string;
}

const PAYMENT: Set<string> = new Set(["payment_federal", "payment_california"]);
const CREDIT: Set<string> = new Set(["credit_federal", "credit_california"]);

function signed(n: number): string {
  return (n > 0 ? "+" : n < 0 ? "−" : "") + fmtMoney(Math.abs(n));
}

/** One per-dollar rate as cents, for the category hint. */
function cents(rate: number): string {
  const c = Math.round(Math.abs(rate) * 1000) / 10;
  return (rate < 0 ? "−" : "") + c + "¢";
}

/**
 * Propose a corrected value for a line. The engine's figure is never
 * overwritten: the change is recorded as a fact with its reason and an
 * estimated tax effect, and the working return applies it.
 */
export function AdjustmentForm({
  target,
  engineValue,
  workingValue,
  defaultCategory,
  rates,
  partnerThreshold,
  prefill,
}: {
  target: string;
  engineValue: number;
  workingValue: number;
  defaultCategory: EffectCategory;
  rates: RateTable;
  partnerThreshold: number;
  prefill?: AdjustmentPrefill;
}) {
  const [open, setOpen] = useState(Boolean(prefill?.newValue || prefill?.reason));
  const [newValue, setNewValue] = useState(prefill?.newValue ?? "");
  const [reason, setReason] = useState(prefill?.reason ?? "");
  const [category, setCategory] = useState<EffectCategory>(defaultCategory);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ value: number } | null>(null);

  const parsed = Number(newValue.replace(/[,$\s]/g, ""));
  const isNumber = newValue.trim() !== "" && Number.isFinite(parsed);
  const same = isNumber && parsed === engineValue;
  const valid = isNumber && !same && reason.trim().length > 0;
  const delta = isNumber ? Math.round((parsed - engineValue) * 100) / 100 : 0;
  const effect = useMemo(() => effectFromRates(category, delta, rates), [category, delta, rates]);
  const worst = Math.max(Math.abs(effect.federal), Math.abs(effect.california));
  const needsPartner = worst > partnerThreshold;
  const share = partnerThreshold > 0 ? Math.min(1, worst / partnerThreshold) : 0;
  const rate = rates[category];
  const categoryHint = PAYMENT.has(category)
    ? "A payment: it moves the balance due dollar for dollar and leaves the tax itself unchanged."
    : CREDIT.has(category)
      ? "A credit: every dollar changes the tax by a dollar."
      : rate
        ? "At " + category.replace(/_/g, " ") + " rates measured on this version: " + cents(rate.federal_per_dollar) + " federal and " + cents(rate.california_per_dollar) + " California per dollar."
        : "No rate is known for this category; the effect is shown as zero.";

  if (!open) {
    return (
      <div className="card p-4">
        {saved ? (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-ok/30 bg-ok-soft px-3 py-2 text-[12.5px] leading-5 text-ok">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Recorded. The working return now uses <span className="font-mono font-semibold tabular-nums">{fmtNumber(saved.value)}</span>; the engine&apos;s figure stays in the record and one click undoes the change.
            </span>
          </div>
        ) : null}
        <button type="button" onClick={() => setOpen(true)} className="pill primary w-full justify-center">
          <PencilLine className="h-3.5 w-3.5" /> Adjust this line
        </button>
        <p className="mt-2 text-center text-[11.5px] leading-4 text-muted">Propose a corrected figure with its reason. The engine&apos;s {fmtNumber(engineValue)} is never overwritten.</p>
      </div>
    );
  }

  return (
    <form
      className="card overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const value = parsed;
        start(async () => {
          setError(null);
          const r = await adjustAction(fd);
          if (r.ok) {
            setSaved({ value });
            setNewValue("");
            setReason("");
            setOpen(false);
          } else setError(r.error);
        });
      }}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em]">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent ring-1 ring-inset ring-accent/25">
              <PencilLine className="h-3.5 w-3.5" />
            </span>
            Adjust {target}
          </h2>
          {prefill?.fromFinding ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted">
              <span>from finding</span>
              <RefLink refId={prefill.fromFinding} />
              <span>· the evidence figure and reason are filled in; edit anything before recording</span>
            </div>
          ) : null}
        </div>
        <button type="button" onClick={() => setOpen(false)} className="icon-btn" aria-label="Close without recording">
          <X className="h-4 w-4" />
        </button>
      </header>

      <input type="hidden" name="target" value={target} />
      {prefill?.fromFinding ? <input type="hidden" name="fromFinding" value={prefill.fromFinding} /> : null}

      <div className="grid gap-4 p-5">
        {/* Engine → corrected */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Engine</div>
            <div className="mt-1.5 font-mono text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-muted">{fmtNumber(engineValue)}</div>
            {workingValue !== engineValue ? <div className="mt-1 text-[11px] text-muted">working now {fmtNumber(workingValue)}</div> : null}
          </div>
          <ArrowRight className="mb-2 h-4 w-4 text-border-strong" />
          <label className="grid gap-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Corrected amount</span>
            <span className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-muted">$</span>
              <input
                name="newValue"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                inputMode="decimal"
                required
                autoFocus={!prefill?.newValue}
                placeholder={fmtNumber(engineValue)}
                aria-invalid={same || (newValue.trim() !== "" && !isNumber) ? true : undefined}
                className={cn("input h-11 w-full pl-7 font-mono text-[18px] font-semibold tabular-nums text-foreground", (same || (newValue.trim() !== "" && !isNumber)) && "border-warn")}
              />
            </span>
          </label>
        </div>
        {same ? (
          <p className="-mt-2 flex items-center gap-1.5 text-[12px] text-warn">
            <AlertTriangle className="h-3.5 w-3.5" /> That is already the engine&apos;s value.
          </p>
        ) : newValue.trim() !== "" && !isNumber ? (
          <p className="-mt-2 flex items-center gap-1.5 text-[12px] text-warn">
            <AlertTriangle className="h-3.5 w-3.5" /> Enter the amount as a number.
          </p>
        ) : null}

        {/* Reason and authority */}
        <label className="grid gap-1 text-[12px] text-muted">
          <span className="flex items-baseline justify-between">
            <span>Why the engine&apos;s figure is wrong</span>
            <span className="text-[11px]">{reason.trim().length ? reason.trim().length + " chars" : "required"}</span>
          </span>
          <textarea name="reason" rows={3} required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What the evidence shows, which document or record it comes from, and why that beats the engine's figure" className="input min-h-[76px] resize-y py-2 text-[13px] leading-5 text-foreground" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-[12px] text-muted">
            Authority relied on <span className="text-[11px]">(optional)</span>
            <input name="authority" placeholder="Code section, publication, form instruction" className="input text-foreground" />
          </label>
          <label className="grid gap-1 text-[12px] text-muted">
            Tax effect category
            <select name="category" value={category} onChange={(e) => setCategory(e.target.value as EffectCategory)} className="input text-foreground">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="-mt-1 text-[11.5px] leading-4 text-muted">{categoryHint}</p>

        {/* Live effect */}
        <div className={cn("rounded-lg border p-3", needsPartner && isNumber ? "border-warn/30 bg-warn-soft/40" : "border-border bg-surface-2/40")}>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">Change</div>
              <div className={cn("mt-1 font-mono text-[16px] font-semibold tabular-nums", !isNumber && "text-muted")}>{isNumber ? signed(delta) : "—"}</div>
            </div>
            <div>
              <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">Federal balance</div>
              <div className={cn("mt-1 font-mono text-[16px] font-semibold tabular-nums", !isNumber ? "text-muted" : effect.federal > 0 ? "text-warn" : effect.federal < 0 ? "text-ok" : "")}>{isNumber ? signed(effect.federal) : "—"}</div>
            </div>
            <div>
              <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">California balance</div>
              <div className={cn("mt-1 font-mono text-[16px] font-semibold tabular-nums", !isNumber ? "text-muted" : effect.california > 0 ? "text-warn" : effect.california < 0 ? "text-ok" : "")}>{isNumber ? signed(effect.california) : "—"}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
              <span className={cn("block h-full rounded-full", needsPartner ? "bg-warn" : "bg-accent")} style={{ width: Math.round(share * 100) + "%" }} />
            </span>
            <span className="whitespace-nowrap text-[11px] text-muted">
              partner threshold {fmtMoney(partnerThreshold)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px] leading-4 text-muted">
            {needsPartner && isNumber ? (
              <Badge tone="warn">
                <ShieldAlert className="h-3 w-3" /> over the threshold: a partner must approve before filing
              </Badge>
            ) : isNumber ? (
              <span>Under the threshold; no partner approval needed for this one.</span>
            ) : (
              <span>Type a corrected amount to see the estimated effect on each balance due.</span>
            )}
            {!effect.affectsTax && isNumber ? <span>Tax itself is unchanged: this is a payment line.</span> : null}
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-2/30 px-5 py-3">
        <button type="submit" disabled={pending || !valid} className={cn("pill primary", (pending || !valid) && "cursor-not-allowed opacity-50")} title={valid ? undefined : "Needs a corrected amount that differs from the engine, and a reason"}>
          <PencilLine className="h-3.5 w-3.5" /> {pending ? "Recording…" : "Record adjustment"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="pill">
          Cancel
        </button>
        {error ? (
          <span className="flex items-center gap-1 text-[12px] text-danger">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </span>
        ) : null}
        <span className="ml-auto text-[11px] text-muted">Rates are measured at this version&apos;s figures; a change that crosses a bracket needs an engine rerun.</span>
      </footer>
    </form>
  );
}
