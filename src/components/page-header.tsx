import type { ReactNode } from "react";
import { cn } from "@/components/ui";

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Chips and badges under the title. */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-5 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1.5 text-[12px] font-medium text-muted">{eyebrow}</div> : null}
        <h1 className="text-[22px] font-semibold leading-7 tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted">{description}</p> : null}
        {meta ? <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
