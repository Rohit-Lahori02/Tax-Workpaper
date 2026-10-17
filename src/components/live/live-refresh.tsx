"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui";

interface Viewer {
  id: string;
  name: string;
  role: string;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Keeps this browser in step with everyone else: when another session writes
 * to the ledger, the page's server components re-render. Also shows who else
 * is in the workpaper right now.
 */
export function LiveRefresh({ initialSeq }: { initialSeq: number }) {
  const router = useRouter();
  const seqRef = useRef(initialSeq);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    seqRef.current = Math.max(seqRef.current, initialSeq);
  }, [initialSeq]);

  useEffect(() => {
    const es = new EventSource("/api/events");
    let pending: ReturnType<typeof setTimeout> | null = null;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { seq: number; viewers: Viewer[] };
        setViewers(data.viewers);
        if (data.seq > seqRef.current) {
          seqRef.current = data.seq;
          if (pending) clearTimeout(pending);
          pending = setTimeout(() => router.refresh(), 250);
        }
      } catch {}
    };
    return () => {
      if (pending) clearTimeout(pending);
      es.close();
    };
  }, [router]);

  return (
    <div className="hidden items-center gap-1.5 md:flex" title={connected ? "Live: changes by others appear automatically" : "Reconnecting to live updates"}>
      <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-ok" : "bg-border-strong")} />
      {viewers.length ? (
        <span className="flex -space-x-1.5">
          {viewers.slice(0, 4).map((v) => (
            <span key={v.id} title={v.name + " · " + v.role.replace(/_/g, " ") + " · viewing now"} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-sidebar bg-accent-soft text-[9px] font-semibold text-accent">
              {initials(v.name)}
            </span>
          ))}
          {viewers.length > 4 ? <span className="pl-2 text-[11px] text-muted">+{viewers.length - 4}</span> : null}
        </span>
      ) : (
        <span className="text-[11px] text-muted">{connected ? "live" : "offline"}</span>
      )}
    </div>
  );
}
