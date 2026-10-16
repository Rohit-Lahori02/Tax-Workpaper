import type { PacketIndex } from "./index";
import type { ExtractedValue, Packet, ReturnLine } from "./schema";

export interface BooksRow {
  /** Books account label, or the tax line label when the item exists only on the return. */
  label: string;
  bookValues: ExtractedValue[];
  books: number | null;
  taxLines: ReturnLine[];
  tax: number | null;
  /** books minus tax for expenses; tax minus books for income. */
  difference: number;
  note: string;
  kind: "income" | "expense" | "tax-only";
}

export interface BooksToTax {
  booksDoc: string | null;
  rows: BooksRow[];
  booksIncome: number | null;
  booksExpenses: number | null;
  booksNet: number | null;
  taxGross: number | null;
  taxExpenses: number | null;
  taxHomeOffice: number | null;
  taxNet: number | null;
}

const TAX_ONLY_NOTES: { pattern: RegExp; note: string }[] = [
  { pattern: /^SchC\.9$/, note: "Standard mileage rate replaces actual fuel; see the mileage log." },
  { pattern: /^SchC\.13$/, note: "Tax depreciation of the studio equipment (bonus) replaces book depreciation." },
  { pattern: /^SchC\.30$/, note: "Home office, simplified method; not an expense in the books." },
  { pattern: /^SchC\.24b$/, note: "Meals limited to 50%." },
];

const BOOK_ONLY_NOTES: { pattern: RegExp; note: (p: Packet, index: PacketIndex, version: string) => string }[] = [
  { pattern: /fuel|car and truck/i, note: (_p, i, v) => "Not deducted as such; the return uses the standard mileage rate on SchC.9 (" + String(i.lines.get(v)?.get("SchC.9")?.value ?? "") + ")." },
  { pattern: /^depreciation$/i, note: (_p, i, v) => "Book depreciation; the return uses tax depreciation on SchC.13 (" + String(i.lines.get(v)?.get("SchC.13")?.value ?? "") + ")." },
  { pattern: /health/i, note: (_p, i, v) => "Owner's health insurance is not a Schedule C expense; deducted on Sch1.17 (" + String(i.lines.get(v)?.get("Sch1.17")?.value ?? "") + ")." },
];

/** Books profit-and-loss lines against the Schedule C lines built from them. */
export function booksToTax(packet: Packet, index: PacketIndex, version = index.latestVersion): BooksToTax {
  const lines = index.lines.get(version)!;
  const booksDoc = packet.documents.find((d) => d.document_type === "books_profit_loss") ?? null;
  const values = booksDoc ? (index.valuesByDocument.get(booksDoc.id) ?? []) : [];
  const totals = new Map(values.filter((v) => /^(total_income|total_expenses|net_income)$/.test(v.field)).map((v) => [v.field, typeof v.value === "number" ? v.value : null]));
  const accounts = values.filter((v) => !/^(total_income|total_expenses|net_income)$/.test(v.field) && typeof v.value === "number");

  const rows: BooksRow[] = [];
  const usedLines = new Set<string>();

  // Income: the books' sales lines feed SchC.1 through the total income figure.
  const incomeAccounts = accounts.filter((v) => /^sales|income|revenue/i.test(v.label) || /^sales/i.test(v.field));
  const gross = lines.get("SchC.1") ?? null;
  const booksIncome = totals.get("total_income") ?? incomeAccounts.reduce((a, v) => a + (v.value as number), 0);
  rows.push({
    label: "Revenue (" + incomeAccounts.map((v) => v.label).join(" + ") + ")",
    bookValues: incomeAccounts,
    books: booksIncome,
    taxLines: gross ? [gross] : [],
    tax: typeof gross?.value === "number" ? gross.value : null,
    difference: (typeof gross?.value === "number" ? gross.value : 0) - (booksIncome ?? 0),
    note: gross && typeof gross.value === "number" && booksIncome !== null && gross.value !== booksIncome ? "Engine adds Form 1099-K amounts it could not match to a deposit." : "Agrees to the books.",
    kind: "income",
  });
  if (gross) usedLines.add(gross.key);

  // Expenses: group book accounts by the Schedule C line that cites them.
  const byLine = new Map<string, ExtractedValue[]>();
  const orphan: ExtractedValue[] = [];
  for (const v of accounts) {
    if (incomeAccounts.includes(v)) continue;
    const refs = (index.linesByValue.get(v.id) ?? []).filter((l) => l.version === version && l.key.startsWith("SchC."));
    if (refs.length === 0) {
      orphan.push(v);
      continue;
    }
    const key = refs[0].key;
    byLine.set(key, [...(byLine.get(key) ?? []), v]);
  }
  for (const [key, vs] of byLine) {
    const line = lines.get(key)!;
    usedLines.add(key);
    const books = vs.reduce((a, v) => a + (v.value as number), 0);
    const tax = typeof line.value === "number" ? line.value : null;
    const diff = books - (tax ?? 0);
    const special = TAX_ONLY_NOTES.find((t) => t.pattern.test(key));
    rows.push({
      label: vs.map((v) => v.label).join(" + "),
      bookValues: vs,
      books,
      taxLines: [line],
      tax,
      difference: diff,
      note: special ? special.note : Math.abs(diff) <= 1 ? "Taken in full." : diff > 0 ? "Partly disallowed or reclassified." : "Return exceeds the books; needs a source.",
      kind: "expense",
    });
  }
  for (const v of orphan) {
    const note = BOOK_ONLY_NOTES.find((b) => b.pattern.test(v.label) || b.pattern.test(v.field));
    rows.push({
      label: v.label,
      bookValues: [v],
      books: v.value as number,
      taxLines: [],
      tax: null,
      difference: v.value as number,
      note: note ? note.note(packet, index, version) : "Not carried to Schedule C.",
      kind: "expense",
    });
  }
  // Schedule C expense lines that have no book source at all.
  for (const l of lines.values()) {
    if (l.form !== "SchC" || usedLines.has(l.key) || typeof l.value !== "number" || l.value === 0) continue;
    if (!/^SchC\.(8|9|1[0-9]|2[0-7][a-z]?(\.\d+)?|30)$/.test(l.key)) continue;
    if (l.inputs.length && !l.sources.length) continue; // subtotals
    const special = TAX_ONLY_NOTES.find((t) => t.pattern.test(l.key));
    rows.push({
      label: l.label,
      bookValues: [],
      books: null,
      taxLines: [l],
      tax: l.value,
      difference: -l.value,
      note: special?.note ?? "On the return only.",
      kind: "tax-only",
    });
  }

  const taxExpenses = typeof lines.get("SchC.28")?.value === "number" ? (lines.get("SchC.28")!.value as number) : null;
  const taxHomeOffice = typeof lines.get("SchC.30")?.value === "number" ? (lines.get("SchC.30")!.value as number) : null;
  const taxNet = typeof lines.get("SchC.31")?.value === "number" ? (lines.get("SchC.31")!.value as number) : null;
  return {
    booksDoc: booksDoc?.id ?? null,
    rows,
    booksIncome,
    booksExpenses: totals.get("total_expenses") ?? null,
    booksNet: totals.get("net_income") ?? null,
    taxGross: typeof gross?.value === "number" ? gross.value : null,
    taxExpenses,
    taxHomeOffice,
    taxNet,
  };
}
