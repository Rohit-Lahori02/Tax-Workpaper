import Link from "next/link";
import { cn } from "@/components/ui";

/** Segmented control that keeps the current path and swaps the version query. */
export function VersionSwitch({
  versions,
  current,
  latest,
  href,
}: {
  versions: string[];
  current: string;
  latest: string;
  href: (version: string) => string;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-[12px]">
      {versions.map((v) => (
        <Link
          key={v}
          href={href(v)}
          className={cn(
            "rounded px-2.5 py-1 font-medium",
            v === current ? "bg-accent text-accent-fg" : "text-muted hover:text-foreground",
          )}
          aria-current={v === current ? "page" : undefined}
        >
          {v}
          {v === latest ? <span className="ml-1 opacity-70">current</span> : null}
        </Link>
      ))}
    </div>
  );
}
