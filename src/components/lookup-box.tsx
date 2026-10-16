"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { hrefFor } from "@/lib/refs";

export function LookupBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const t = q.trim();
        if (t) router.push(hrefFor(t));
      }}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Go to ev-0703, F1040.11, D30, qa-14…"
        aria-label="Packet reference"
        className="w-72 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-mono"
      />
      <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white">
        Open
      </button>
    </form>
  );
}
