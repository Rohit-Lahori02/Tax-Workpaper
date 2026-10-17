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
    <header className={cn("fade-up mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1.5 text-[12px] font-medium text-muted">{eyebrow}</div> : null}
        <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em]">{title}</h1>
        {description ? <div className="mt-1.5 max-w-3xl text-[13.5px] leading-[22px] text-muted">{description}</div> : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
