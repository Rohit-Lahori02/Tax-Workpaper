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
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        ref.current?.focus();
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
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        suppressHydrationWarning
        placeholder="Search the file, or jump to F1040.11, ev-0703, D30, qa-14"
        aria-label="Search the file or jump to a reference"
        className="h-8 w-full rounded-full border border-border bg-surface pl-9 pr-9 text-[12.5px] outline-none placeholder:text-muted focus:border-accent"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        <Kbd>/</Kbd>
      </span>
    </form>
  );
}
