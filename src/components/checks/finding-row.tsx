import { AlertTriangle, ArrowRight, ArrowUpRight, Info, OctagonAlert } from "lucide-react";
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
const SEVERITY_LABEL: Record<Severity, string> = { error: "Error", warning: "Warning", info: "Info" };

export function SeverityIcon({ severity, className }: { severity: Severity; className?: string }) {
  const Icon = severity === "error" ? OctagonAlert : severity === "warning" ? AlertTriangle : Info;
  return (
    <span
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
        severity === "error" ? "bg-danger-soft text-danger ring-danger/20" : severity === "warning" ? "bg-warn-soft text-warn ring-warn/25" : "bg-surface-2 text-muted ring-border",
        className,
      )}
      title={SEVERITY_LABEL[severity]}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
    </span>
  );
}

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
  const href = hrefFor("check:" + f.id);
  const hasCompare = f.expected !== undefined || f.actual !== undefined;
  return (
    <li className="group relative flex gap-3 px-5 py-4 transition-colors hover:bg-surface-2/40">
      <SeverityIcon severity={f.severity} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={href} className="text-[13.5px] font-semibold leading-5 tracking-[-0.005em] hover:text-accent">
              {f.title}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <EffectBadge effect={f.effect} />
              {typeof f.difference === "number" && f.difference !== 0 ? (
                <Badge tone="neutral" mono title="Difference between the return and the evidence">
                  Δ {(f.difference > 0 ? "+" : "−") + fmtMoney(Math.abs(f.difference))}
                </Badge>
              ) : null}
              {summary ? <Marks s={summary} /> : null}
            </div>
          </div>
          <Link href={href} className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-muted opacity-0 transition-opacity hover:bg-surface-2 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100">
            open <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        <p className={cn("mt-1.5 text-[12.5px] leading-5 text-muted", expanded ? "" : "line-clamp-2")}>{f.detail}</p>

        {hasCompare ? (
          <div className="mt-2.5 inline-grid grid-cols-[auto_auto_auto] items-center gap-x-3 rounded-lg border border-border bg-surface-2/60 px-3 py-2">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted">On the return</div>
              <div className="font-mono text-[12.5px] tabular-nums">{f.actual ?? "—"}</div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-border-strong" />
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted">Evidence says</div>
              <div className="font-mono text-[12.5px] tabular-nums text-foreground">{f.expected ?? "—"}</div>
            </div>
          </div>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {f.refs.slice(0, expanded ? undefined : 8).map((r) => (
            <RefLink key={r} refId={r} />
          ))}
          {!expanded && f.refs.length > 8 ? <span className="text-[11px] text-muted">+{f.refs.length - 8} more</span> : null}
        </div>
      </div>
    </li>
  );
}
