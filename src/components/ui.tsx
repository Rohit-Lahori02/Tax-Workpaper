import { Fragment, type ReactNode } from "react";

export function Card({
  title,
  aside,
  className,
  children,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={"rounded-lg border border-border bg-surface p-4 " + (className ?? "")}>
      {title ? (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
          {aside}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export type Tone = "neutral" | "warn" | "ok" | "accent";

const toneClass: Record<Tone, string> = {
  neutral: "bg-border/60 text-foreground",
  warn: "bg-warn-soft text-warn",
  ok: "bg-ok/15 text-ok",
  accent: "bg-accent-soft text-accent",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={"inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium " + toneClass[tone]}>
      {children}
    </span>
  );
}

export function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
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
  return <p className="text-sm text-muted">{children}</p>;
}

export const tableClass = "w-full text-sm [&_th]:text-left [&_th]:font-medium [&_th]:text-muted [&_th]:pb-1 [&_td]:py-1 [&_td]:align-top [&_td]:border-t [&_td]:border-border";
export const numClass = "text-right tabular-nums";
