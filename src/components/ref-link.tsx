import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui";
import { hrefFor } from "@/lib/refs";

/** A link to any packet reference, rendered as a small code chip so ids stay recognisable. */
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
  /** Sans-serif link, for names rather than ids. */
  plain?: boolean;
}) {
  return (
    <Link href={href ?? hrefFor(refId)} className={cn(plain ? "text-accent hover:underline" : "ref", className)} title={refId}>
      {children ?? refId}
    </Link>
  );
}
