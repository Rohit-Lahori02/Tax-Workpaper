"use client";

import {
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  Clock,
  Files,
  FileSignature,
  FileSpreadsheet,
  FlaskConical,
  Gavel,
  GitCompare,
  History,
  Inbox,
  Mail,
  Printer,
  LayoutDashboard,
  ListChecks,
  Map,
  MessageCircleQuestion,
  PenLine,
  Send,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
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

type Item = { href: string; label: string; icon: typeof Files; exact?: boolean; ledger?: boolean; badge?: "questions" | "checks" | "unseen" | "work" };

const SECTIONS: { label: string | null; items: Item[] }[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/work", label: "My work", icon: Inbox, badge: "work" },
    ],
  },
  {
    label: "Review",
    items: [
      { href: "/return", label: "Return", icon: FileSpreadsheet },
      { href: "/documents", label: "Documents", icon: Files },
      { href: "/checks", label: "Checks", icon: ListChecks, badge: "checks", ledger: true },
      { href: "/compare", label: "Compare", icon: GitCompare, ledger: true },
      { href: "/what-ifs", label: "What-ifs", icon: FlaskConical, ledger: true },
      { href: "/judgment", label: "Judgment", icon: Gavel, ledger: true },
      { href: "/completeness", label: "Completeness", icon: ClipboardCheck, ledger: true },
      { href: "/review", label: "Sign-offs", icon: PenLine, ledger: true },
      { href: "/approve", label: "Client approval", icon: FileSignature },
    ],
  },
  {
    label: "Filing",
    items: [
      { href: "/filing", label: "File and amend", icon: Send, ledger: true },
      { href: "/client-copy", label: "Client copy", icon: Printer },
      { href: "/notices", label: "Notices", icon: Mail, ledger: true },
      { href: "/next-year", label: "Next year", icon: CalendarRange, ledger: true },
      { href: "/timeline", label: "Timeline", icon: Clock },
    ],
  },
  {
    label: "Workpapers",
    items: [
      { href: "/sales", label: "Sales detail", icon: TrendingUp },
      { href: "/assets", label: "Depreciation", icon: Building2 },
      { href: "/books", label: "Books to tax", icon: BookOpen },
      { href: "/state", label: "California split", icon: Map },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/questions", label: "Questions", icon: MessageCircleQuestion, badge: "questions" },
      { href: "/changes", label: "Since I looked", icon: Bell, badge: "unseen" },
      { href: "/activity", label: "Activity", icon: History, ledger: true },
    ],
  },
];

export function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({
  firm,
  client,
  showLedger,
  openQuestions,
  checkErrors,
  unseen,
  work,
}: {
  firm: string;
  client: SidebarClient;
  showLedger: boolean;
  openQuestions: number;
  checkErrors: number;
  unseen: number;
  work: number;
}) {
  const pathname = usePathname();
  const badge = (b: Item["badge"]) => (b === "questions" ? openQuestions : b === "checks" ? checkErrors : b === "unseen" ? unseen : b === "work" ? work : 0);
  return (
    <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[12px] font-bold text-accent-fg">{firm.slice(0, 1)}</span>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold">{firm}</div>
          <div className="text-[11px] text-muted">Workpaper</div>
        </div>
        <span className="ml-auto rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">TY {client.taxYear}</span>
      </div>

      <nav className="scroll-thin flex flex-1 flex-col gap-3 overflow-auto px-2 pb-2">
        {SECTIONS.map((section) => {
          const items = section.items.filter((i) => showLedger || !i.ledger);
          if (!items.length) return null;
          return (
            <div key={section.label ?? "top"}>
              {section.label ? <div className="px-2.5 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">{section.label}</div> : null}
              <div className="flex flex-col gap-px">
                {items.map((item) => {
                  const active = isActive(pathname, item.href, item.exact);
                  const Icon = item.icon;
                  const n = badge(item.badge);
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
                      {n > 0 ? (
                        <span className={cn("ml-auto rounded-full px-1.5 text-[10px] font-semibold leading-4", item.badge === "checks" ? "bg-danger-soft text-danger" : item.badge === "unseen" ? "bg-accent-soft text-accent" : item.badge === "work" ? "bg-warn-soft text-warn" : "bg-accent text-accent-fg")}>
                          {n}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="mt-auto px-2 pt-2">
          <div className="mb-2 px-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">Engagement</div>
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
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const items = SECTIONS.flatMap((s) => s.items).filter((i) => !i.ledger);
  return (
    <nav className="flex items-center gap-1 overflow-auto lg:hidden">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-medium",
            isActive(pathname, item.href, item.exact) ? "bg-accent-soft text-foreground" : "text-muted hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
