"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Kbd } from "@/components/ui";
import { hrefFor } from "@/lib/refs";

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
      className={"relative " + (className ?? "")}
      onSubmit={(e) => {
        e.preventDefault();
        const t = q.trim();
        if (t) {
          router.push(hrefFor(t));
          setQ("");
          ref.current?.blur();
        }
      }}
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Jump to F1040.11, ev-0703, D30, qa-14…"
        aria-label="Jump to a packet reference"
        className="h-8 w-72 rounded-md border border-border bg-surface-2 pl-8 pr-8 font-mono text-[12px] outline-none placeholder:font-sans placeholder:text-muted focus:border-accent focus:bg-surface"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
        <Kbd>/</Kbd>
      </span>
    </form>
  );
}
