import { parseRef, resolveDotted, resolvePointer, type Ref } from "@/lib/refs";
import type {
  CallNote,
  ClientMessage,
  ExtractedValue,
  Packet,
  PacketDocument,
  Person,
  PriorAssetRecord,
  QuestionnaireItem,
  ReturnLine,
  ReturnVersion,
  Staff,
  TimelineEvent,
  VersionAsset,
} from "./schema";

export interface LineRef {
  version: string;
  key: string;
}

export interface IntegrityIssue {
  code: string;
  severity: "warning" | "info";
  message: string;
  refs: string[];
}

export interface DocumentUsage {
  usedIn: string[];
  supersededIn: string[];
  linesReached: LineRef[];
}

export interface PriorYearLine {
  value: number | string;
  label?: string;
  source?: string;
}

/**
 * Forward and reverse links over the packet. Built once per process; nothing
 * here is ever mutated after construction.
 */
export interface PacketIndex {
  documents: Map<string, PacketDocument>;
  values: Map<string, ExtractedValue>;
  valuesByDocument: Map<string, ExtractedValue[]>;
  versions: Map<string, ReturnVersion>;
  versionOrder: string[];
  latestVersion: string;
  /** version -> line key -> line */
  lines: Map<string, Map<string, ReturnLine>>;
  /** extracted value id -> lines that cite it */
  linesByValue: Map<string, LineRef[]>;
  /** non-value source reference (py:, qa-, asset:, ...) -> lines that cite it */
  linesBySource: Map<string, LineRef[]>;
  /** version -> line key -> keys that list it as an input */
  dependents: Map<string, Map<string, string[]>>;
  documentUsage: Map<string, DocumentUsage>;
  people: Map<string, Person>;
  staff: Map<string, Staff>;
  questionnaire: Map<string, QuestionnaireItem>;
  messages: Map<string, ClientMessage>;
  callNotes: Map<string, CallNote>;
  timeline: Map<string, TimelineEvent>;
  /** latest version's assets by id */
  assets: Map<string, VersionAsset>;
  priorAssets: Map<string, PriorAssetRecord>;
  priorYearLines: Map<string, PriorYearLine>;
  integrity: IntegrityIssue[];
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

export function buildIndex(packet: Packet): PacketIndex {
  const integrity: IntegrityIssue[] = [];
  const issue = (code: string, severity: IntegrityIssue["severity"], message: string, refs: string[]) =>
    integrity.push({ code, severity, message, refs });

  const documents = new Map(packet.documents.map((d) => [d.id, d] as const));
  const values = new Map<string, ExtractedValue>();
  const valuesByDocument = new Map<string, ExtractedValue[]>();

  for (const v of packet.extracted_values) {
    if (values.has(v.id)) {
      issue("DUPLICATE_VALUE_ID", "warning", `Extracted value id ${v.id} appears more than once.`, [v.id]);
    }
    values.set(v.id, v);
    const doc = documents.get(v.document_id);
    if (!doc) {
      issue(
        "VALUE_DOCUMENT_MISSING",
        "warning",
        `${v.id} points at document ${v.document_id}, which is not in the packet.`,
        [v.id],
      );
      continue;
    }
    if (v.page < 1 || v.page > doc.page_count) {
      issue(
        "VALUE_PAGE_OUT_OF_RANGE",
        "warning",
        `${v.id} is on page ${v.page} but ${doc.id} has ${doc.page_count} pages.`,
        [v.id, doc.id],
      );
    }
    push(valuesByDocument, v.document_id, v);
  }

  for (const d of packet.documents) {
    const actual = valuesByDocument.get(d.id)?.length ?? 0;
    if (actual !== d.extraction.values) {
      issue(
        "EXTRACTION_COUNT_MISMATCH",
        "info",
        `${d.id} reports ${d.extraction.values} extracted values but the packet holds ${actual}.`,
        [d.id],
      );
    }
    if (d.pages.length !== d.page_count) {
      issue(
        "PAGE_COUNT_MISMATCH",
        "info",
        `${d.id} says ${d.page_count} pages but ${d.pages.length} page records are present.`,
        [d.id],
      );
    }
  }

  const sortedVersions = [...packet.return_versions].sort((a, b) =>
    a.computed_at.localeCompare(b.computed_at),
  );
  const versions = new Map(sortedVersions.map((v) => [v.version, v] as const));
  const versionOrder = sortedVersions.map((v) => v.version);
  const latestVersion = versionOrder[versionOrder.length - 1];

  const lines = new Map<string, Map<string, ReturnLine>>();
  const linesByValue = new Map<string, LineRef[]>();
  const linesBySource = new Map<string, LineRef[]>();
  const dependents = new Map<string, Map<string, string[]>>();
  const documentUsage = new Map<string, DocumentUsage>();
  for (const d of packet.documents) {
    documentUsage.set(d.id, { usedIn: [], supersededIn: [], linesReached: [] });
  }

  for (const version of sortedVersions) {
    const byKey = new Map<string, ReturnLine>();
    for (const line of version.lines) {
      if (byKey.has(line.key)) {
        issue("DUPLICATE_LINE_KEY", "warning", `${version.version} has two lines keyed ${line.key}.`, [line.key]);
      }
      byKey.set(line.key, line);
    }
    lines.set(version.version, byKey);

    const deps = new Map<string, string[]>();
    const reachedByDoc = new Map<string, Set<string>>();
    for (const line of version.lines) {
      const ref: LineRef = { version: version.version, key: line.key };
      for (const input of line.inputs) {
        if (!byKey.has(input)) {
          issue(
            "INPUT_LINE_MISSING",
            "warning",
            `${version.version} ${line.key} lists input ${input}, which is not a line in that version.`,
            [line.key],
          );
        }
        push(deps, input, line.key);
      }
      for (const src of line.sources) {
        const parsed = parseRef(src);
        if (parsed.kind === "value") {
          const v = values.get(parsed.id);
          if (!v) {
            issue(
              "SOURCE_VALUE_MISSING",
              "warning",
              `${version.version} ${line.key} cites ${src}, which is not an extracted value.`,
              [line.key, src],
            );
            continue;
          }
          push(linesByValue, parsed.id, ref);
          let set = reachedByDoc.get(v.document_id);
          if (!set) reachedByDoc.set(v.document_id, (set = new Set()));
          set.add(line.key);
        } else {
          push(linesBySource, src, ref);
        }
      }
    }
    dependents.set(version.version, deps);

    for (const id of version.documents_used) {
      const u = documentUsage.get(id);
      if (u) u.usedIn.push(version.version);
      else issue("DOCUMENT_USED_MISSING", "warning", `${version.version} lists ${id} as used but no such document exists.`, [id]);
    }
    for (const id of version.documents_superseded) {
      const u = documentUsage.get(id);
      if (u) u.supersededIn.push(version.version);
      else issue("DOCUMENT_SUPERSEDED_MISSING", "warning", `${version.version} lists ${id} as superseded but no such document exists.`, [id]);
    }
    for (const [docId, keys] of reachedByDoc) {
      const u = documentUsage.get(docId);
      if (u) for (const key of keys) u.linesReached.push({ version: version.version, key });
    }
  }

  const people = new Map(packet.household.people.map((p) => [p.id, p] as const));
  const staff = new Map(packet.firm.staff.map((s) => [s.id, s] as const));
  const questionnaire = new Map(packet.client.questionnaire.map((q) => [q.id, q] as const));
  const messages = new Map(packet.client.messages.map((m) => [m.id, m] as const));
  const callNotes = new Map(packet.client.call_notes.map((c) => [c.id, c] as const));
  const timeline = new Map(packet.timeline.map((t) => [t.id, t] as const));
  const latest = versions.get(latestVersion)!;
  const assets = new Map(latest.assets.map((a) => [a.asset_id, a] as const));
  const priorAssets = new Map(packet.prior_years.asset_records.map((a) => [a.asset_id, a] as const));
  const priorYearLines = new Map<string, PriorYearLine>();
  for (const [key, value] of Object.entries(packet.prior_years.return_2024.lines)) {
    priorYearLines.set(key, {
      value,
      label: packet.prior_years.return_2024.line_labels[key],
      source: packet.prior_years.return_2024.line_sources[key],
    });
  }

  const index: PacketIndex = {
    documents,
    values,
    valuesByDocument,
    versions,
    versionOrder,
    latestVersion,
    lines,
    linesByValue,
    linesBySource,
    dependents,
    documentUsage,
    people,
    staff,
    questionnaire,
    messages,
    callNotes,
    timeline,
    assets,
    priorAssets,
    priorYearLines,
    integrity,
  };

  // References made by diagnostics and the timeline must land somewhere.
  for (const version of sortedVersions) {
    for (const diag of version.diagnostics) {
      for (const r of diag.refs) {
        if (!refExists(parseRef(r), packet, index, version.version)) {
          issue(
            "DIAGNOSTIC_REF_UNRESOLVED",
            "info",
            `${version.version} diagnostic ${diag.code} points at ${r}, which does not resolve.`,
            [r],
          );
        }
      }
    }
  }
  for (const ev of packet.timeline) {
    for (const r of ev.refs) {
      if (!refExists(parseRef(r), packet, index)) {
        issue("TIMELINE_REF_UNRESOLVED", "info", `Timeline event ${ev.id} points at ${r}, which does not resolve.`, [ev.id, r]);
      }
    }
    if (ev.actor && !staff.has(ev.actor)) {
      issue("TIMELINE_ACTOR_UNKNOWN", "info", `Timeline event ${ev.id} names actor ${ev.actor}, who is not on staff.`, [ev.id]);
    }
  }

  return index;
}

/** True when a parsed reference points at something that exists in the packet. */
export function refExists(ref: Ref, packet: Packet, index: PacketIndex, version?: string): boolean {
  switch (ref.kind) {
    case "value":
      return index.values.has(ref.id);
    case "document": {
      const d = index.documents.get(ref.id);
      return !!d && (ref.page === undefined || (ref.page >= 1 && ref.page <= d.page_count));
    }
    case "line": {
      if (version) return index.lines.get(version)?.has(ref.key) ?? false;
      for (const m of index.lines.values()) if (m.has(ref.key)) return true;
      return index.priorYearLines.has(ref.key);
    }
    case "version":
      return index.versions.has(ref.id);
    case "questionnaire":
      return index.questionnaire.has(ref.id);
    case "message":
      return index.messages.has(ref.id);
    case "call":
      return index.callNotes.has(ref.id);
    case "staff":
      return index.staff.has(ref.id);
    case "client_user":
      return packet.firm.client_users.some((c) => c.id === ref.id);
    case "person":
      return index.people.has(ref.id);
    case "asset":
      return index.assets.has(ref.id) || index.priorAssets.has(ref.id);
    case "timeline":
      return index.timeline.has(ref.id);
    case "notice":
      return packet.tax_agency_records.notices.some((n) => n.id === ref.id);
    case "prior_year":
      return resolvePointer(packet.prior_years, ref.pointer) !== undefined;
    case "agency":
      return resolvePointer(packet.tax_agency_records, ref.pointer) !== undefined;
    case "engine_param":
      return resolveDotted(packet.engine_reference.parameters, ref.path) !== undefined;
    case "check":
      return true;
    case "unknown":
      return false;
  }
}
