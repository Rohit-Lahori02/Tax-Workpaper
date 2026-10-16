import type { ReactNode } from "react";
import { Badge } from "@/components/ui";

export function RecordHeader({
  kind,
  id,
  title,
  subtitle,
  children,
}: {
  kind: string;
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 grid gap-1">
      <div className="flex items-center gap-2 text-sm">
        <Badge tone="accent">{kind}</Badge>
        <span className="font-mono text-muted">{id}</span>
      </div>
      <h1 className="text-xl font-semibold">{title}</h1>
      {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      {children}
    </header>
  );
}
