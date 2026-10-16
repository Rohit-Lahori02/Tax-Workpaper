import type { PacketIndex } from "./index";
import type { ExtractedValue, ReturnLine } from "./schema";

export type Term = "short" | "long";

export interface LotRow {
  key: string;
  box: string;
  lot: string;
  term: Term;
  description: string;
  acquired: string | null;
  sold: string | null;
  proceeds: number | null;
  basis: number | null;
  adjustment: number;
  gain: number;
  docId: string | null;
  /** Extracted value that opens the document viewer on this lot. */
  anchorValue: string | null;
  /** True when a supplemental statement replaced the broker's basis. */
  supplemented: boolean;
}

const SHORT_BOXES = new Set(["A", "B", "C", "H"]);

/** Schedule D line each Form 8949 box rolls into. */
export const SCHEDULE_D_LINE: Record<string, string> = {
  A: "SchD.1b",
  B: "SchD.2",
  C: "SchD.3",
  H: "SchD.3",
  D: "SchD.8b",
  E: "SchD.9",
  F: "SchD.10",
  K: "SchD.10",
};

function num(v: ExtractedValue | undefined): number | null {
  return v && typeof v.value === "number" ? v.value : null;
}

function text(v: ExtractedValue | undefined): string | null {
  return v && typeof v.value === "string" ? v.value : null;
}

export function lotRows(index: PacketIndex, version = index.latestVersion): LotRow[] {
  const rows: LotRow[] = [];
  for (const l of index.lines.get(version)?.values() ?? []) {
    if (l.rule !== "R-8949-LOT" || typeof l.value !== "number") continue;
    const [, box, lot] = l.key.split(".");
    const fields = new Map<string, ExtractedValue>();
    let docId: string | null = null;
    let supplemented = false;
    for (const s of l.sources) {
      const v = index.values.get(s);
      if (!v) continue;
      const m = /_(description|desc|acquired|acq|sold|proceeds|basis|wash|adjusted_basis)$/.exec(v.field);
      if (!m) continue;
      const name = m[1] === "desc" ? "description" : m[1] === "acq" ? "acquired" : m[1];
      if (name === "adjusted_basis") supplemented = true;
      if (!fields.has(name)) fields.set(name, v);
      if (!docId && name !== "adjusted_basis") docId = v.document_id;
    }
    const proceeds = num(fields.get("proceeds"));
    const basis = num(fields.get("adjusted_basis")) ?? num(fields.get("basis"));
    const wash = num(fields.get("wash")) ?? 0;
    const labelMatch = /^(.*?)\s*\(acquired/.exec(l.label);
    rows.push({
      key: l.key,
      box,
      lot,
      term: SHORT_BOXES.has(box) ? "short" : "long",
      description: text(fields.get("description")) ?? labelMatch?.[1] ?? l.label,
      acquired: text(fields.get("acquired")) ?? /acquired (\d{4}-\d{2}(?:-\d{2})?)/.exec(l.label)?.[1] ?? null,
      sold: text(fields.get("sold")) ?? /sold (\d{4}-\d{2}-\d{2})/.exec(l.label)?.[1] ?? null,
      proceeds: proceeds ?? parseLabelMoney(l.label, "proceeds"),
      basis: basis ?? parseLabelMoney(l.label, "basis"),
      adjustment: proceeds !== null && basis !== null ? Math.round((l.value - (proceeds - basis)) * 100) / 100 : wash,
      gain: l.value,
      docId,
      anchorValue: fields.get("proceeds")?.id ?? fields.get("description")?.id ?? null,
      supplemented,
    });
  }
  rows.sort((a, b) => (a.sold ?? "").localeCompare(b.sold ?? "") || a.key.localeCompare(b.key));
  return rows;
}

function parseLabelMoney(label: string, word: string): number | null {
  const m = new RegExp(word + " ([\\d,]+(?:\\.\\d+)?)").exec(label);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

export interface BoxSummary {
  box: string;
  term: Term;
  lots: number;
  proceeds: number;
  basis: number;
  adjustment: number;
  gain: number;
  boxTotalLine: ReturnLine | null;
  scheduleDLine: ReturnLine | null;
}

export function boxSummaries(rows: LotRow[], index: PacketIndex, version = index.latestVersion): BoxSummary[] {
  const lines = index.lines.get(version)!;
  const byBox = new Map<string, BoxSummary>();
  for (const r of rows) {
    let s = byBox.get(r.box);
    if (!s) {
      byBox.set(
        r.box,
        (s = {
          box: r.box,
          term: r.term,
          lots: 0,
          proceeds: 0,
          basis: 0,
          adjustment: 0,
          gain: 0,
          boxTotalLine: lines.get("F8949." + r.box + ".total") ?? null,
          scheduleDLine: lines.get(SCHEDULE_D_LINE[r.box] ?? "") ?? null,
        }),
      );
    }
    s.lots += 1;
    s.proceeds += r.proceeds ?? 0;
    s.basis += r.basis ?? 0;
    s.adjustment += r.adjustment;
    s.gain += r.gain;
  }
  return [...byBox.values()].sort((a, b) => a.box.localeCompare(b.box));
}
