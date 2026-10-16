import clsx from "clsx";
import { Fragment, type ReactNode } from "react";

export const cn = clsx;

export function Card({
  title,
  description,
  aside,
  className,
  bodyClassName,
  flush,
  children,
}: {
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
    <section
      className={cn(
        "rounded-[10px] border border-border bg-surface shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {title ? (
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold leading-5">{title}</h2>
            {description ? <p className="text-xs text-muted">{description}</p> : null}
          </div>
          {aside ? <div className="shrink-0 text-xs text-muted">{aside}</div> : null}
        </header>
      ) : null}
      <div className={cn(flush ? "" : "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted ring-border",
  accent: "bg-accent-soft text-accent ring-accent/20",
  ok: "bg-ok-soft text-ok ring-ok/20",
  warn: "bg-warn-soft text-warn ring-warn/20",
  danger: "bg-danger-soft text-danger ring-danger/20",
};

export function Badge({
  tone = "neutral",
  mono,
  className,
  children,
}: {
  tone?: Tone;
  mono?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset",
        toneClass[tone],
        mono && "font-mono",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  delta,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: { text: string; tone: Tone };
  tone?: Tone;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
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
  );
}

export function KV({ rows, className }: { rows: [string, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[max-content_1fr] gap-x-5 gap-y-1.5 text-[13px]", className)}>
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
  return <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[13px] text-muted">{children}</p>;
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted", className)}>{children}</h3>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-surface-2 px-1 py-px font-mono text-[10px] text-muted">{children}</kbd>
  );
}
