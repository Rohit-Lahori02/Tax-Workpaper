import clsx from "clsx";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

export const cn = clsx;

export function Card({
  id,
  title,
  description,
  aside,
  className,
  bodyClassName,
  flush,
  children,
}: {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** No inner padding, for tables that run edge to edge. */
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("card overflow-hidden", className)}>
      {title ? (
        <header className="flex items-start justify-between gap-3 px-4 pb-2 pt-3.5">
          <div className="min-w-0">
            <h2 className="text-[13.5px] font-semibold leading-5">{title}</h2>
            {description ? <p className="mt-0.5 text-[12px] leading-4 text-muted">{description}</p> : null}
          </div>
          {aside ? <div className="shrink-0 text-[12px] text-muted">{aside}</div> : null}
        </header>
      ) : null}
      <div className={cn(flush ? (title ? "border-t border-border" : "") : title ? "px-4 pb-4 pt-1" : "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
};

export function Badge({
  tone = "neutral",
  mono,
  dot,
  className,
  title,
  children,
}: {
  tone?: Tone;
  mono?: boolean;
  dot?: boolean;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
        toneClass[tone],
        mono && "font-mono",
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function Pill({
  href,
  primary,
  icon,
  className,
  children,
}: {
  href: string;
  primary?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn("pill", primary && "primary", className)}>
      {icon}
      {children}
    </Link>
  );
}

export function Stat({
  label,
  value,
  hint,
  delta,
  tone,
  chart,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: { text: string; tone: Tone };
  tone?: Tone;
  chart?: ReactNode;
}) {
  return (
    <div className="card flex items-stretch justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted">{label}</div>
        <div
          className={cn(
            "mt-1.5 text-[26px] font-semibold leading-none tabular-nums tracking-tight",
            tone === "ok" && "text-ok",
            tone === "warn" && "text-warn",
            tone === "danger" && "text-danger",
          )}
        >
          {value}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
          {delta ? (
            <span
              className={cn(
                "font-medium tabular-nums",
                delta.tone === "ok" && "text-ok",
                delta.tone === "warn" && "text-warn",
                delta.tone === "danger" && "text-danger",
              )}
            >
              {delta.text}
            </span>
          ) : null}
          {hint}
        </div>
      </div>
      {chart ? <div className="flex w-24 shrink-0 items-end">{chart}</div> : null}
    </div>
  );
}

export function KV({ rows, className }: { rows: [string, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2 text-[13px]", className)}>
      {rows.map(([k, v]) => (
        <Fragment key={k}>
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-[13px] text-muted">{children}</p>;
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted", className)}>{children}</h3>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-border bg-surface-2 px-1.5 py-px font-mono text-[10px] text-muted">{children}</kbd>;
}

/** Horizontal stacked bar for a small set of counts. */
export function StackedBar({ parts, total }: { parts: { label: string; value: number; tone: Tone }[]; total: number }) {
  const color: Record<Tone, string> = {
    neutral: "bg-border-strong",
    accent: "bg-accent",
    ok: "bg-ok",
    warn: "bg-warn",
    danger: "bg-danger",
  };
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <div key={p.label} className={color[p.tone]} style={{ width: (p.value / total) * 100 + "%" }} title={p.label + ": " + p.value} />
          ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", color[p.tone])} />
            <span className="tabular-nums text-foreground">{p.value}</span> {p.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
