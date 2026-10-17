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
        <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold leading-5 tracking-[-0.01em]">{title}</h2>
            {description ? <p className="mt-1 max-w-3xl text-[12.5px] leading-5 text-muted">{description}</p> : null}
          </div>
          {aside ? <div className="shrink-0 pt-0.5 text-[12px] text-muted">{aside}</div> : null}
        </header>
      ) : null}
      <div className={cn(flush ? cn("overflow-x-auto", title && "border-t border-border") : title ? "px-5 pb-5 pt-1" : "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted ring-border",
  accent: "bg-accent-soft text-accent ring-accent/20",
  ok: "bg-ok-soft text-ok ring-ok/20",
  warn: "bg-warn-soft text-warn ring-warn/25",
  danger: "bg-danger-soft text-danger ring-danger/20",
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
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-px text-[11px] font-medium leading-[18px] ring-1 ring-inset max-sm:whitespace-normal",
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

const toneText: Record<Tone, string> = {
  neutral: "",
  accent: "text-accent",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
};

const toneDot: Record<Tone, string> = {
  neutral: "bg-border-strong",
  accent: "bg-accent",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
};

export function Stat({
  label,
  value,
  hint,
  delta,
  tone,
  chart,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: { text: string; tone: Tone };
  tone?: Tone;
  chart?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="card flex items-stretch justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
          {tone && tone !== "neutral" ? <span className={cn("h-1.5 w-1.5 rounded-full", toneDot[tone])} /> : null}
          {label}
        </div>
        <div className={cn("mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums", tone ? toneText[tone] : "")}>{value}</div>
        {hint || delta ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[12px] leading-4 text-muted">
            {delta ? <span className={cn("font-medium tabular-nums", toneText[delta.tone])}>{delta.text}</span> : null}
            {hint}
          </div>
        ) : null}
      </div>
      {chart ? <div className="flex w-24 shrink-0 items-end">{chart}</div> : icon ? <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">{icon}</div> : null}
    </div>
  );
}

export function KV({ rows, className }: { rows: [string, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-[13px]", className)}>
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
  return <p className="rounded-lg border border-dashed border-border-strong/70 bg-surface-2/40 px-3 py-6 text-center text-[13px] text-muted">{children}</p>;
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted", className)}>{children}</h3>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-border bg-surface-2 px-1.5 py-px font-mono text-[10.5px] leading-4 text-muted shadow-[inset_0_-1px_0_var(--border)]">{children}</kbd>;
}

/** Horizontal stacked bar for a small set of counts. */
export function StackedBar({ parts, total }: { parts: { label: string; value: number; tone: Tone }[]; total: number }) {
  return (
    <div>
      <div className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-surface-2">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <div key={p.label} className={cn("first:rounded-l-full last:rounded-r-full", toneDot[p.tone])} style={{ width: (p.value / total) * 100 + "%" }} title={p.label + ": " + p.value} />
          ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", toneDot[p.tone])} />
            <span className="tabular-nums text-foreground">{p.value}</span> {p.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
