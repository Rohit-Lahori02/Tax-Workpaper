import type { CheckRun } from "@/lib/checks/run";
import type { Ledger } from "@/lib/facts/ledger";
import { KIND_LABELS } from "@/lib/facts/types";
import { maskText } from "@/lib/mask";
import type { PacketIndex } from "@/lib/packet/index";
import type { Packet } from "@/lib/packet/schema";
import { documentHref, hrefFor, lineHref } from "@/lib/refs";

/**
 * Full-text search over everything in the file: return lines, documents and
 * the values read from them, the client's answers, messages and calls, the
 * checks' findings, the timeline and (for staff) the ledger. Pure, in-memory;
 * the packet is a few megabytes and the ledger a few thousand rows at most.
 */

export type SearchGroup = "lines" | "documents" | "values" | "client" | "checks" | "records" | "timeline" | "people" | "assets";

export const GROUP_LABELS: Record<SearchGroup, string> = {
  lines: "Return lines",
  documents: "Documents",
  values: "Values read from documents",
  client: "Questionnaire, messages and calls",
  checks: "Check findings",
  records: "Workpaper records",
  timeline: "Timeline",
  people: "People",
  assets: "Assets",
};

export interface SearchHit {
  group: SearchGroup;
  id: string;
  title: string;
  detail: string;
  href: string;
  score: number;
}

export interface SearchResult {
  query: string;
  terms: string[];
  hits: SearchHit[];
  byGroup: { group: SearchGroup; hits: SearchHit[] }[];
  total: number;
  /** When the query is exactly one reference, where it lives. */
  exact: string | null;
}

const PER_GROUP = 25;

function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^["']|["']$/g, ""))
    .filter((t) => t.length > 0);
}

/** Every term must appear somewhere in the haystack; score favors title hits, prefix hits and short titles. */
function scoreOf(terms: string[], title: string, detail: string): number {
  const t = title.toLowerCase();
  const d = detail.toLowerCase();
  let score = 0;
  for (const term of terms) {
    const inTitle = t.includes(term);
    const inDetail = d.includes(term);
    if (!inTitle && !inDetail) return 0;
    score += inTitle ? 3 : 1;
    if (t === term) score += 6;
    else if (t.startsWith(term)) score += 2;
    if (new RegExp("(^|[^a-z0-9])" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)").test(t)) score += 1;
  }
  return score + Math.max(0, 2 - title.length / 60);
}

export function search(packet: Packet, index: PacketIndex, ledger: Ledger, checks: CheckRun, rawQuery: string, opts: { staff: boolean; literals: string[]; now?: string }): SearchResult {
  const query = rawQuery.trim().slice(0, 200);
  const terms = tokens(query);
  const hits: SearchHit[] = [];
  const mask = (s: string) => maskText(s, opts.literals);
  const add = (group: SearchGroup, id: string, title: string, detail: string, href: string) => {
    if (!terms.length) return;
    const safeTitle = mask(title);
    const safeDetail = mask(detail);
    const score = scoreOf(terms, safeTitle, safeDetail);
    if (score > 0) hits.push({ group, id, title: safeTitle, detail: safeDetail, href, score });
  };
  const fmt = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-US") : v === null || v === undefined ? "" : String(v));

  const version = index.latestVersion;
  for (const l of index.lines.get(version)?.values() ?? []) {
    add("lines", l.key, l.key + " · " + l.label, l.form + " · " + fmt(l.value) + (l.note ? " · " + l.note : "") + " · rule " + l.rule, lineHref(l.key));
  }
  for (const d of packet.documents) {
    add("documents", d.id, d.id + " · " + d.title, d.document_type + " · " + d.issuer + " · " + d.belongs_to + " · " + d.file_name + " · " + d.pages.map((p) => p.printed_content.slice(0, 400)).join(" "), documentHref(d.id));
  }
  for (const v of index.values.values()) {
    add("values", v.id, v.id + " · " + v.label, "read as \"" + v.text_as_read + "\" = " + fmt(v.value) + " · " + v.document_id + " page " + v.page + " · " + v.field, documentHref(v.document_id, { page: v.page, value: v.id }));
  }
  for (const q of packet.client.questionnaire) add("client", q.id, q.id + " · " + q.question, q.answer + " · " + q.answered_by, hrefFor(q.id));
  for (const m of packet.client.messages) add("client", m.id, m.id + " · message from " + m.from, m.text, hrefFor(m.id));
  for (const c of packet.client.call_notes) add("client", c.id, c.id + " · call " + c.date, c.participants.join(", ") + " · " + c.notes.join(" "), hrefFor(c.id));
  for (const f of checks.findings) add("checks", f.id, f.title, f.detail + " · " + f.severity + " · " + f.refs.join(" "), "/checks/" + encodeURIComponent(f.id));
  for (const t of packet.timeline) add("timeline", t.id, t.event.replace(/_/g, " ") + " · " + t.at.slice(0, 10), (t.detail ?? "") + " · " + t.refs.join(" "), "/timeline#tl:" + t.id);
  for (const p of packet.household.people) add("people", p.id, p.name, p.role + (p.relationship ? " · " + p.relationship : "") + (p.occupation ? " · " + p.occupation : ""), "/#household");
  for (const s of packet.firm.staff) add("people", s.id, s.name, s.role.replace(/_/g, " ") + " · " + packet.firm.name, "/work");
  for (const a of index.assets.values()) add("assets", a.asset_id, a.asset_id + " · " + a.description, a.activity + " · placed in service " + a.placed_in_service, "/assets#" + encodeURIComponent(a.asset_id));
  if (opts.staff) {
    for (const f of ledger.all) {
      if (["seen", "sensitive_view", "retract", "resolve"].includes(f.kind)) continue;
      const text = [f.body.text, f.body.reason, f.body.type, f.body.name, f.body.choice, f.body.authority].filter((x): x is string => typeof x === "string").join(" · ");
      add("records", f.id, (KIND_LABELS[f.kind as keyof typeof KIND_LABELS] ?? f.kind) + " · " + f.target, text + " · " + f.actorName + " · " + f.at.slice(0, 10), hrefFor(f.target));
    }
  }

  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const groups = (Object.keys(GROUP_LABELS) as SearchGroup[]).map((group) => ({ group, hits: hits.filter((h) => h.group === group).slice(0, PER_GROUP) })).filter((g) => g.hits.length);
  const exactHit = terms.length === 1 ? hits.find((h) => h.id.toLowerCase() === terms[0]) : undefined;
  return { query, terms, hits, byGroup: groups, total: hits.length, exact: exactHit ? exactHit.href : null };
}
