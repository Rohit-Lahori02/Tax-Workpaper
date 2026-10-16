/**
 * Locates each extracted value's text inside the printed page text so the
 * simulated page can highlight the exact field it was read from.
 */

export interface MarkInput {
  id: string;
  text: string;
  position: { x0: number; y0: number; x1: number; y1: number };
}

export interface PageMark {
  start: number;
  end: number;
  valueId: string;
}

export interface Segment {
  text: string;
  valueId?: string;
}

export interface MarkResult {
  marks: PageMark[];
  /** Values whose text could not be found on the page as read. */
  unmatched: string[];
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end;
}

export function computeMarks(pageText: string, values: MarkInput[]): MarkResult {
  // Reading order, so a value printed twice (box 3 and box 5 on a W-2) takes
  // the first free occurrence in the order the pipeline positioned it.
  const ordered = [...values].sort((a, b) => a.position.y0 - b.position.y0 || a.position.x0 - b.position.x0);
  const marks: PageMark[] = [];
  const unmatched: string[] = [];

  for (const v of ordered) {
    const needle = v.text;
    if (!needle) {
      unmatched.push(v.id);
      continue;
    }
    let from = 0;
    let placed = false;
    while (from <= pageText.length) {
      const at = pageText.indexOf(needle, from);
      if (at === -1) break;
      const candidate = { start: at, end: at + needle.length };
      if (!marks.some((m) => overlaps(m, candidate))) {
        marks.push({ ...candidate, valueId: v.id });
        placed = true;
        break;
      }
      from = at + 1;
    }
    if (!placed) unmatched.push(v.id);
  }

  marks.sort((a, b) => a.start - b.start);
  return { marks, unmatched };
}

export function segmentText(pageText: string, marks: PageMark[]): Segment[] {
  const out: Segment[] = [];
  let cursor = 0;
  for (const m of marks) {
    if (m.start > cursor) out.push({ text: pageText.slice(cursor, m.start) });
    out.push({ text: pageText.slice(m.start, m.end), valueId: m.valueId });
    cursor = m.end;
  }
  if (cursor < pageText.length) out.push({ text: pageText.slice(cursor) });
  return out;
}
