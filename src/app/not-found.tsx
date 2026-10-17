import { ArrowRight, FileSearch, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Kbd, Pill } from "@/components/ui";
import { hrefFor } from "@/lib/refs";

export const metadata: Metadata = { title: "Not in the packet" };

/** One example per reference format, each one real so the link proves the format. */
const FORMATS: { example: string; what: string }[] = [
  { example: "F1040.11", what: "a return line" },
  { example: "ev-0703", what: "a value read from a document" },
  { example: "D30", what: "a document" },
  { example: "qa-14", what: "a questionnaire answer" },
  { example: "asset:SAC-BLDG", what: "a depreciable asset" },
  { example: "py:/carryovers_into_2025", what: "a prior-year record" },
  { example: "check:low-confidence:ev-0919", what: "a check finding" },
  { example: "v3", what: "a return version" },
];

const PLACES: { href: string; label: string; why: string }[] = [
  { href: "/", label: "Overview", why: "where the file stands today" },
  { href: "/return", label: "Return", why: "every line, by form" },
  { href: "/documents", label: "Documents", why: "what the client sent" },
  { href: "/checks", label: "Checks", why: "what still needs attention" },
];

export default function NotFound() {
  return (
    <div className="fade-up mx-auto grid max-w-3xl gap-6 py-10">
      <div className="grid justify-items-center gap-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent ring-1 ring-inset ring-accent/25">
          <FileSearch className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em]">Nothing in the packet matches that reference</h1>
          <p className="mx-auto mt-2 max-w-xl text-[13.5px] leading-[22px] text-muted">
            Either the reference is spelled differently from how the packet spells it, or the record is not in this file. Nothing was changed; the ledger only grows when someone records something.
          </p>
        </div>
        <form action="/search" method="get" className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input name="q" placeholder="Search the file instead" aria-label="Search the file" className="input h-10 w-full pl-9 pr-12 text-[13px]" autoComplete="off" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Kbd>↵</Kbd>
          </span>
        </form>
      </div>

      <section className="card overflow-hidden">
        <header className="flex items-center justify-between px-5 pb-3 pt-4">
          <h2 className="text-[14px] font-semibold leading-5 tracking-[-0.01em]">How references are written</h2>
          <span className="text-[12px] text-muted">
            Type one in the box at the top, or press <Kbd>/</Kbd>
          </span>
        </header>
        <ul className="grid border-t border-border sm:grid-cols-2">
          {FORMATS.map((f, i) => (
            <li key={f.example} className={"border-border " + (i % 2 === 0 ? "sm:border-r" : "") + (i < FORMATS.length - 2 ? " border-b" : i === FORMATS.length - 2 ? " border-b sm:border-b-0" : "")}>
              <Link href={hrefFor(f.example)} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-surface-2/60">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="ref pointer-events-none">{f.example}</span>
                  <span className="truncate text-[12.5px] text-muted">{f.what}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-border-strong" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {PLACES.map((p) => (
          <Pill key={p.href} href={p.href} primary={p.href === "/"}>
            {p.label}
            <span className="hidden text-[11px] font-normal opacity-70 sm:inline">· {p.why}</span>
          </Pill>
        ))}
      </div>
    </div>
  );
}
