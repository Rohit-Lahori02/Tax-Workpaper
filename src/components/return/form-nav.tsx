import Link from "next/link";
import { cn } from "@/components/ui";
import { formLabel, formShort, sortForms } from "@/lib/forms";
import type { PacketIndex } from "@/lib/packet/index";

export interface FormEntry {
  jurisdiction: "federal" | "california";
  form: string;
  count: number;
}

export function formsInVersion(index: PacketIndex, version: string): FormEntry[] {
  const counts = new Map<string, FormEntry>();
  for (const line of index.lines.get(version)?.values() ?? []) {
    const e = counts.get(line.form);
    if (e) e.count += 1;
    else counts.set(line.form, { jurisdiction: line.jurisdiction, form: line.form, count: 1 });
  }
  return sortForms([...counts.values()]);
}

/** The forms in a version, grouped by jurisdiction, with per-form attention counts when supplied. */
export function FormNav({ forms, active, version, attention }: { forms: FormEntry[]; active: string; version: string; attention?: Record<string, number> }) {
  const groups: { label: string; items: FormEntry[] }[] = [
    { label: "Federal", items: forms.filter((f) => f.jurisdiction === "federal") },
    { label: "California", items: forms.filter((f) => f.jurisdiction === "california") },
  ];
  return (
    <>
      {/* Below the large breakpoint the list would push the lines off screen; a scrolling strip of chips takes its place. */}
      <nav className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden" aria-label="Forms">
        {forms.map((f) => {
          const n = attention?.[f.form] ?? 0;
          return (
            <Link key={f.form} href={"/return/" + encodeURIComponent(f.form) + "?v=" + encodeURIComponent(version)} title={formLabel(f.form)} className={cn("chip shrink-0", f.form === active && "is-active")}>
              {n ? <span className="h-1.5 w-1.5 rounded-full bg-warn" /> : null}
              {formShort(f.form)}
              <span className="count">{f.count}</span>
            </Link>
          );
        })}
      </nav>
    <nav className="card sticky top-[72px] hidden max-h-[calc(100vh-6rem)] overflow-auto scroll-thin p-2 lg:block" aria-label="Forms">
      {groups.map((g) => (
        <div key={g.label} className="mb-2 last:mb-0">
          <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted/80">
            {g.label}
            <span className="font-mono text-[10px] normal-case tracking-normal">{g.items.reduce((n, f) => n + f.count, 0)}</span>
          </div>
          <ul className="flex flex-col gap-px">
            {g.items.map((f) => {
              const n = attention?.[f.form] ?? 0;
              return (
                <li key={f.form}>
                  <Link href={"/return/" + encodeURIComponent(f.form) + "?v=" + encodeURIComponent(version)} title={formLabel(f.form)} className={cn("nav-item h-[30px] px-2.5 text-[12.5px]", f.form === active && "is-active")}>
                    <span className="truncate">{formShort(f.form)}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {n ? <span className="h-1.5 w-1.5 rounded-full bg-warn" title={n + " line(s) need attention"} /> : null}
                      <span className="font-mono text-[11px] tabular-nums text-muted">{f.count}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
    </>
  );
}
