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
    <div className="seg" role="tablist" aria-label="Return version">
      {options.map((v) => (
        <Link key={v.id} href={href(v.id)} className={cn("seg-item", v.id === current && "is-active")} aria-current={v.id === current ? "page" : undefined} title={v.hint}>
          {v.id === "working" ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
          {v.label ?? v.id}
          {v.id === latest ? <span className="rounded-full bg-ok-soft px-1.5 text-[10px] font-semibold leading-4 text-ok">current</span> : null}
        </Link>
      ))}
    </div>
  );
}
