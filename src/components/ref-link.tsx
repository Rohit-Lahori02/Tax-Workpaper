import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui";
import { hrefFor } from "@/lib/refs";

/** A link to any packet reference, rendered in monospace so ids stay recognisable. */
export function RefLink({
  refId,
  href,
  children,
  className,
  plain,
}: {
  refId: string;
  /** Override the destination, for example a document viewer focused on a value. */
  href?: string;
  children?: ReactNode;
  className?: string;
  /** Sans-serif, for names rather than ids. */
  plain?: boolean;
}) {
  return (
    <Link
      href={href ?? hrefFor(refId)}
      className={cn("text-accent hover:underline", plain ? "" : "font-mono text-[12px]", className)}
    >
      {children ?? refId}
    </Link>
  );
}
