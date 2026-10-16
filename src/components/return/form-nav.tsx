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

export function FormNav({ forms, active, version }: { forms: FormEntry[]; active: string; version: string }) {
  const groups: { label: string; items: FormEntry[] }[] = [
    { label: "Federal", items: forms.filter((f) => f.jurisdiction === "federal") },
    { label: "California", items: forms.filter((f) => f.jurisdiction === "california") },
  ];
  return (
    <nav className="card sticky top-[68px] max-h-[calc(100vh-6rem)] overflow-auto scroll-thin p-2">
      {groups.map((g) => (
        <div key={g.label} className="mb-2">
          <div className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.label}</div>
          <ul>
            {g.items.map((f) => (
              <li key={f.form}>
                <Link
                  href={"/return/" + encodeURIComponent(f.form) + "?v=" + encodeURIComponent(version)}
                  title={formLabel(f.form)}
                  className={cn(
                    "flex h-7 items-center justify-between gap-2 rounded-md px-2 text-[12.5px]",
                    f.form === active ? "bg-accent-soft font-medium text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  <span className="truncate">{formShort(f.form)}</span>
                  <span className="font-mono text-[11px] text-muted">{f.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
