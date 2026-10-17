"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Kbd } from "@/components/ui";
import { hrefFor, parseRef } from "@/lib/refs";

export function LookupBox({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      className={"relative max-w-xl " + (className ?? "")}
      onSubmit={(e) => {
        e.preventDefault();
        const t = q.trim();
        if (t) {
          // A reference jumps straight to its record; anything else is a search.
          router.push(parseRef(t).kind === "unknown" || /\s/.test(t) ? "/search?q=" + encodeURIComponent(t) : hrefFor(t));
          setQ("");
          ref.current?.blur();
        }
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
      <input
        ref={ref}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        suppressHydrationWarning
        placeholder="Search the file, or jump to F1040.11, ev-0703, D30, qa-14"
        aria-label="Search the file or jump to a reference"
        className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-16 text-[13px] shadow-[var(--card-inset)] outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]"
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
        <Kbd>⌘K</Kbd>
        <Kbd>/</Kbd>
      </span>
    </form>
  );
}
