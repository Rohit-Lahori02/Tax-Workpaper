"use client";

import { CalendarClock, Files, FileSpreadsheet, LayoutDashboard, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export interface SidebarClient {
  name: string;
  clientId: string;
  taxYear: number;
  version: string;
  computedAt: string;
  nextDeadline: { what: string; date: string } | null;
  warnings: number;
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
    <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[12px] font-bold text-accent-fg">
          {firm.slice(0, 1)}
        </span>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold">{firm}</div>
          <div className="text-[11px] text-muted">Workpaper</div>
        </div>
        <span className="ml-auto rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          TY {client.taxYear}
        </span>
      </div>

      <nav className="flex flex-col gap-px px-2">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                active ? "bg-accent-soft text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-accent" : "")} strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 px-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Engagement</div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="truncate text-[13px] font-medium">{client.name}</div>
          <div className="mt-0.5 font-mono text-[11px] text-muted">{client.clientId}</div>
          <dl className="mt-3 grid gap-2 text-[12px]">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
              <div>
                <dt className="text-muted">Current return</dt>
                <dd>
                  {client.version} · {client.computedAt}
                </dd>
              </div>
            </div>
            {client.nextDeadline ? (
              <div className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
                <div>
                  <dt className="text-muted">Next deadline</dt>
                  <dd className="leading-snug">
                    {client.nextDeadline.date}
                    <div className="text-[11px] text-muted">{client.nextDeadline.what}</div>
                  </dd>
                </div>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

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
            isActive(pathname, item.href, item.exact) ? "bg-accent-soft text-foreground" : "text-muted hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
