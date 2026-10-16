import type { PacketIndex } from "./index";
import type { PacketDocument } from "./schema";

export type DocumentState = "reached" | "unused" | "superseded" | "not_extracted";

export interface DocumentRow {
  id: string;
  title: string;
  type: string;
  issuer: string;
  belongsTo: string;
  taxYear: number;
  receivedAt: string;
  uploadedBy: string;
  pageCount: number;
  extraction: PacketDocument["extraction"]["status"];
  reason: string | null;
  values: number;
  usedIn: string[];
  supersededIn: string[];
  linesReached: number;
  corrected: boolean;
  state: DocumentState;
  /** The corrected document that replaced this one, when the packet has it. */
  replacedBy: string | null;
}

/** Where a document stands against one return version. */
export function documentState(doc: PacketDocument, index: PacketIndex, version: string): DocumentState {
  const u = index.documentUsage.get(doc.id);
  if (u?.supersededIn.length) return "superseded";
  if (doc.extraction.status === "not_extracted") return "not_extracted";
  if (u?.linesReached.some((l) => l.version === version)) return "reached";
  return "unused";
}

export function findReplacement(doc: PacketDocument, index: PacketIndex): PacketDocument | null {
  if (!index.documentUsage.get(doc.id)?.supersededIn.length) return null;
  let best: PacketDocument | null = null;
  for (const other of index.documents.values()) {
    if (other.id === doc.id || !other.marked_corrected) continue;
    if (other.document_type !== doc.document_type || other.issuer !== doc.issuer || other.belongs_to !== doc.belongs_to) continue;
    if (other.received_at < doc.received_at) continue;
    if (!best || other.received_at < best.received_at) best = other;
  }
  return best;
}

export function documentRows(index: PacketIndex, version: string): DocumentRow[] {
  const rows: DocumentRow[] = [];
  for (const d of index.documents.values()) {
    const u = index.documentUsage.get(d.id)!;
    rows.push({
      id: d.id,
      title: d.title,
      type: d.document_type,
      issuer: d.issuer,
      belongsTo: d.belongs_to,
      taxYear: d.tax_year,
      receivedAt: d.received_at,
      uploadedBy: d.uploaded_by,
      pageCount: d.page_count,
      extraction: d.extraction.status,
      reason: d.extraction.reason ?? null,
      values: index.valuesByDocument.get(d.id)?.length ?? 0,
      usedIn: u.usedIn,
      supersededIn: u.supersededIn,
      linesReached: new Set(u.linesReached.filter((l) => l.version === version).map((l) => l.key)).size,
      corrected: Boolean(d.marked_corrected),
      state: documentState(d, index, version),
      replacedBy: findReplacement(d, index)?.id ?? null,
    });
  }
  rows.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  return rows;
}
