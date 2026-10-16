"use client";

import { Files, FileSpreadsheet, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export interface SidebarClient {
  name: string;
  clientId: string;
  taxYear: number;
  version: string;
  computedAt: string;
}

export const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/return", label: "Return", icon: FileSpreadsheet, exact: false },
  { href: "/documents", label: "Documents", icon: Files, exact: false },
] as const;

export function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ firm, client }: { firm: string; client: SidebarClient }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-border bg-surface lg:flex">
      <div className="px-4 pb-3 pt-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{firm}</div>
        <div className="text-[15px] font-semibold tracking-tight">Workpaper</div>
      </div>
      <div className="mx-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
        <div className="truncate text-[13px] font-medium">{client.name}</div>
        <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted">
          <span className="font-mono">{client.clientId}</span>
          <span>TY {client.taxYear}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-ok" />
          Return {client.version} · {client.computedAt}
        </div>
      </div>
      <nav className="mt-4 flex flex-col gap-0.5 px-3">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                active ? "bg-accent-soft text-accent" : "text-foreground/80 hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-4 py-4 text-[11px] leading-4 text-muted">
        Every number links to its source. Nothing in the packet is ever edited.
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 lg:hidden">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-md px-2 py-1 text-[13px] font-medium",
            isActive(pathname, item.href, item.exact) ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
