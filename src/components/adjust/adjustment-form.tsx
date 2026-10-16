"use client";

import { PencilLine } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Badge, cn } from "@/components/ui";
import { CATEGORIES, CATEGORY_LABELS, effectFromRates, type EffectCategory, type RateTable } from "@/lib/effective";
import { adjustAction } from "@/lib/facts/actions-adjust";
import { fmtMoney } from "@/lib/format";

export interface AdjustmentPrefill {
  newValue?: string;
  reason?: string;
  fromFinding?: string;
}

const input = "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-accent";

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
  const [category, setCategory] = useState<EffectCategory>(defaultCategory);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const parsed = Number(newValue.replace(/[,$\s]/g, ""));
  const valid = newValue.trim() !== "" && Number.isFinite(parsed);
  const delta = valid ? Math.round((parsed - engineValue) * 100) / 100 : 0;
  const effect = useMemo(() => effectFromRates(category, delta, rates), [category, delta, rates]);
  const needsPartner = Math.abs(effect.federal) > partnerThreshold || Math.abs(effect.california) > partnerThreshold;
  const money = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmtMoney(Math.abs(n));

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="pill w-full justify-center">
        <PencilLine className="h-3.5 w-3.5" /> Adjust this line
      </button>
    );
  }

  return (
    <form
      className="card grid gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          setError(null);
          const r = await adjustAction(fd);
          if (r.ok) {
            setSaved(true);
            setNewValue("");
            form.reset();
            setOpen(false);
          } else setError(r.error);
        });
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[13.5px] font-semibold">Adjust {target}</h2>
        <span className="font-mono text-[11px] text-muted">engine {fmtMoney(engineValue)}{workingValue !== engineValue ? " · working " + fmtMoney(workingValue) : ""}</span>
      </div>
      <input type="hidden" name="target" value={target} />
      {prefill?.fromFinding ? <input type="hidden" name="fromFinding" value={prefill.fromFinding} /> : null}
      <label className="grid gap-1 text-[12px] text-muted">
        Corrected amount
        <input name="newValue" value={newValue} onChange={(e) => setNewValue(e.target.value)} inputMode="decimal" required placeholder={String(engineValue)} className={cn(input, "font-mono text-foreground")} />
      </label>
      <label className="grid gap-1 text-[12px] text-muted">
        Why
        <textarea name="reason" rows={3} required defaultValue={prefill?.reason ?? ""} placeholder="What the evidence shows and why the engine's figure is wrong" className={cn(input, "text-foreground")} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-[12px] text-muted">
          Authority relied on (optional)
          <input name="authority" placeholder="Code section, publication, form instruction" className={cn(input, "text-foreground")} />
        </label>
        <label className="grid gap-1 text-[12px] text-muted">
          Tax effect category
          <select name="category" value={category} onChange={(e) => setCategory(e.target.value as EffectCategory)} className={cn(input, "text-foreground")}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-[12.5px]">
        <span className="text-muted">Change</span>
        <span className="font-mono tabular-nums">{valid ? money(delta) : "—"}</span>
        <span className="text-muted">· estimated effect on balance due</span>
        <span className="font-mono tabular-nums">{valid ? money(effect.federal) + " federal" : "—"}</span>
        <span className="font-mono tabular-nums">{valid ? money(effect.california) + " CA" : ""}</span>
        {!effect.affectsTax && valid ? <span className="text-muted">(payment: tax unchanged)</span> : null}
        {needsPartner && valid ? <Badge tone="warn">over {fmtMoney(partnerThreshold)}: partner sign-off required</Badge> : null}
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending || !valid} className="rounded-full bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-fg disabled:opacity-50">
          Record adjustment
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-border px-3 py-1.5 text-[12.5px] text-muted hover:text-foreground">
          Cancel
        </button>
        {error ? <span className="text-[12px] text-danger">{error}</span> : null}
        {saved ? <span className="text-[12px] text-ok">Recorded. The working return now uses the corrected amount.</span> : null}
      </div>
      <p className="text-[11px] text-muted">
        The engine&apos;s number stays in the record. Rates are measured at the current version&apos;s figures; large changes that cross a threshold need an engine rerun.
      </p>
    </form>
  );
}
