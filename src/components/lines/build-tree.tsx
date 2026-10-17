import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { Badge, cn } from "@/components/ui";
import { fmtLineValue } from "@/lib/format";
import type { PacketIndex } from "@/lib/packet/index";
import { lineHref } from "@/lib/refs";

const MAX_DEPTH = 6;

/**
 * The calculation tree behind a line: each input line, and its inputs, down to
 * the lines that come straight from documents. Server-rendered; the browser
 * only toggles the native disclosure.
 */
export function BuildTree({ rootKey, version, index }: { rootKey: string; version: string; index: PacketIndex }) {
  const lines = index.lines.get(version);
  if (!lines) return null;

  const node = (key: string, depth: number, trail: string[]) => {
    const line = lines.get(key);
    const children = line?.inputs ?? [];
    const cyclic = trail.includes(key);
    const leaf = !children.length || cyclic || depth >= MAX_DEPTH;
    const root = depth === 0;
    const row = (
      <div className={cn("flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-1.5 pr-2", root && "py-2")}>
        <Link href={lineHref(key, version)} className={cn("ref shrink-0", root && "border-accent/40 bg-accent-soft text-accent")}>
          {key}
        </Link>
        <span className={cn("min-w-0 truncate text-[13px]", root ? "font-semibold" : "text-foreground/90")}>{line ? line.label : <span className="text-warn">not in {version}</span>}</span>
        {line?.sources.length ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted" title={line.sources.length + " cited source(s)"}>
            <FileText className="h-3 w-3" /> {line.sources.length}
          </span>
        ) : null}
        <span className={cn("ml-auto shrink-0 pl-3 font-mono tabular-nums", root ? "text-[15px] font-semibold" : "text-[12.5px] font-medium")}>{line ? fmtLineValue(line.value) : ""}</span>
        {line ? <span className="hidden w-[110px] shrink-0 truncate text-right font-mono text-[10.5px] text-muted sm:inline-block">{line.rule}</span> : null}
      </div>
    );

    if (leaf) {
      return (
        <li key={key} className="flex items-center gap-1">
          <span className="inline-block h-3.5 w-3.5 shrink-0" />
          {row}
          {cyclic ? <Badge tone="warn">cycle</Badge> : null}
        </li>
      );
    }
    return (
      <li key={key}>
        <details open={depth < 2} className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md hover:bg-surface-2/70 [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted transition-transform group-open:rotate-90" />
            {row}
          </summary>
          <ul className="ml-[7px] border-l border-border pl-3">{children.map((c) => node(c, depth + 1, [...trail, key]))}</ul>
        </details>
      </li>
    );
  };

  return (
    <div>
      <div className="mb-1 hidden items-center justify-end gap-2 pr-2 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted sm:flex">
        <span>Value</span>
        <span className="w-[110px] text-right">Rule</span>
      </div>
      <ul className="text-[13px]">{node(rootKey, 0, [])}</ul>
    </div>
  );
}
