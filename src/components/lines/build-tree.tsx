import { ChevronRight } from "lucide-react";
import { RefLink } from "@/components/ref-link";
import { Badge } from "@/components/ui";
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
    const row = (
      <div className="flex min-w-0 flex-1 items-baseline gap-2 py-1">
        <RefLink refId={key} href={lineHref(key, version)} />
        <span className="min-w-0 truncate text-[13px]">{line ? line.label : <span className="text-warn">not in {version}</span>}</span>
        {line?.sources.length ? (
          <span className="shrink-0 text-[11px] text-muted">
            {line.sources.length} source{line.sources.length === 1 ? "" : "s"}
          </span>
        ) : null}
        <span className="ml-auto shrink-0 pl-3 font-medium tabular-nums">{line ? fmtLineValue(line.value) : ""}</span>
        {line ? (
          <Badge mono className="shrink-0">
            {line.rule}
          </Badge>
        ) : null}
      </div>
    );

    if (!children.length || cyclic || depth >= MAX_DEPTH) {
      return (
        <li key={key} className="flex items-start gap-1">
          <span className="mt-2 inline-block h-3.5 w-3.5 shrink-0" />
          {row}
          {cyclic ? <Badge tone="warn">cycle</Badge> : null}
        </li>
      );
    }
    return (
      <li key={key}>
        <details open={depth < 2} className="group">
          <summary className="flex cursor-pointer list-none items-start gap-1 rounded hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
            <ChevronRight className="mt-2 h-3.5 w-3.5 shrink-0 text-muted transition-transform group-open:rotate-90" />
            {row}
          </summary>
          <ul className="ml-[7px] border-l border-border pl-3">{children.map((c) => node(c, depth + 1, [...trail, key]))}</ul>
        </details>
      </li>
    );
  };

  return <ul className="text-[13px]">{node(rootKey, 0, [])}</ul>;
}
