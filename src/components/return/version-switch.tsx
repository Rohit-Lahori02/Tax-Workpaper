import Link from "next/link";
import { cn } from "@/components/ui";

export interface VersionOption {
  id: string;
  label?: string;
  hint?: string;
}

/** Segmented control that keeps the current path and swaps the version query. */
export function VersionSwitch({
  versions,
  current,
  latest,
  href,
}: {
  versions: (string | VersionOption)[];
  current: string;
  latest: string;
  href: (version: string) => string;
}) {
  const options: VersionOption[] = versions.map((v) => (typeof v === "string" ? { id: v } : v));
  return (
    <div className="inline-flex rounded-full border border-border bg-surface p-0.5 text-[12px]">
      {options.map((v) => (
        <Link
          key={v.id}
          href={href(v.id)}
          className={cn("rounded-full px-2.5 py-1 font-medium", v.id === current ? "bg-accent text-accent-fg" : "text-muted hover:text-foreground")}
          aria-current={v.id === current ? "page" : undefined}
          title={v.hint}
        >
          {v.label ?? v.id}
          {v.id === latest ? <span className="ml-1 opacity-70">current</span> : null}
        </Link>
      ))}
    </div>
  );
}
