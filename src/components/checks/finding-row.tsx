import Link from "next/link";
import { Marks } from "@/components/facts/fact-marks";
import { RefLink } from "@/components/ref-link";
import { Badge, cn } from "@/components/ui";
import type { Finding, Severity } from "@/lib/checks/types";
import type { TargetSummary } from "@/lib/facts/types";
import { fmtMoney } from "@/lib/format";
import { hrefFor } from "@/lib/refs";

export const SEVERITY_TONE: Record<Severity, "danger" | "warn" | "neutral"> = { error: "danger", warning: "warn", info: "neutral" };
export const SEVERITY_DOT: Record<Severity, string> = { error: "bg-danger", warning: "bg-warn", info: "bg-border-strong" };

export function EffectBadge({ effect }: { effect: Finding["effect"] }) {
  if (!effect || (effect.federal === 0 && effect.california === 0)) return null;
  const part = (n: number, label: string) => (n === 0 ? null : (n > 0 ? "+" : "−") + fmtMoney(Math.abs(n)) + " " + label);
  const text = [part(effect.federal, "federal"), part(effect.california, "CA")].filter(Boolean).join(" · ");
  const tone = effect.federal + effect.california > 0 ? "warn" : "ok";
  return (
    <Badge tone={tone} title="Estimated change in tax if corrected, from the engine's per-dollar rates">
      tax {text}
    </Badge>
  );
}

export function FindingRow({ f, summary, expanded }: { f: Finding; summary?: TargetSummary; expanded?: boolean }) {
  return (
    <li className="flex gap-3 px-4 py-3">
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", SEVERITY_DOT[f.severity])} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={hrefFor("check:" + f.id)} className="text-[13.5px] font-medium hover:underline">
            {f.title}
          </Link>
          <EffectBadge effect={f.effect} />
          {summary ? <Marks s={summary} /> : null}
        </div>
        <p className={cn("mt-1 text-[13px] text-muted", expanded ? "" : "line-clamp-2")}>{f.detail}</p>
        {f.expected !== undefined || f.actual !== undefined ? (
          <div className="mt-1.5 flex flex-wrap gap-x-4 text-[12px]">
            {f.actual !== undefined ? (
              <span>
                <span className="text-muted">on the return </span>
                <span className="font-mono tabular-nums">{f.actual}</span>
              </span>
            ) : null}
            {f.expected !== undefined ? (
              <span>
                <span className="text-muted">evidence says </span>
                <span className="font-mono tabular-nums">{f.expected}</span>
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {f.refs.slice(0, expanded ? undefined : 8).map((r) => (
            <RefLink key={r} refId={r} />
          ))}
          {!expanded && f.refs.length > 8 ? <span className="text-[11px] text-muted">+{f.refs.length - 8} more</span> : null}
        </div>
      </div>
    </li>
  );
}
