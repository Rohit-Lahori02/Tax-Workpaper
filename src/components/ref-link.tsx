import Link from "next/link";
import type { ReactNode } from "react";
import { hrefFor } from "@/lib/refs";

/** A link to any packet reference, rendered in monospace so ids stay recognisable. */
export function RefLink({ refId, children, className }: { refId: string; children?: ReactNode; className?: string }) {
  return (
    <Link href={hrefFor(refId)} className={"font-mono text-accent hover:underline " + (className ?? "")}>
      {children ?? refId}
    </Link>
  );
}
