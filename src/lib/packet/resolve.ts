import { resolveDotted, resolvePointer, type Ref } from "@/lib/refs";
import type { DocumentUsage, LineRef, PacketIndex, PriorYearLine } from "./index";
import type { ExtractedValue, Packet, PacketDocument, ReturnLine } from "./schema";

export type Resolved =
  | { kind: "value"; value: ExtractedValue; document: PacketDocument | null; landsOn: LineRef[] }
  | { kind: "document"; document: PacketDocument; page?: number; values: ExtractedValue[]; usage: DocumentUsage }
  | {
      kind: "line";
      key: string;
      byVersion: { version: string; line: ReturnLine | null }[];
      priorYear: PriorYearLine | null;
    }
  | { kind: "generic"; title: string; subtitle?: string; data: unknown };

/** Turns a parsed reference into the packet record(s) it points at, or null. */
export function resolveRef(ref: Ref, packet: Packet, index: PacketIndex): Resolved | null {
  switch (ref.kind) {
    case "value": {
      const value = index.values.get(ref.id);
      if (!value) return null;
      return {
        kind: "value",
        value,
        document: index.documents.get(value.document_id) ?? null,
        landsOn: index.linesByValue.get(value.id) ?? [],
      };
    }
    case "document": {
      const document = index.documents.get(ref.id);
      if (!document) return null;
      return {
        kind: "document",
        document,
        page: ref.page,
        values: index.valuesByDocument.get(document.id) ?? [],
        usage: index.documentUsage.get(document.id) ?? { usedIn: [], supersededIn: [], linesReached: [] },
      };
    }
    case "line": {
      const byVersion = index.versionOrder.map((version) => ({
        version,
        line: index.lines.get(version)?.get(ref.key) ?? null,
      }));
      const priorYear = index.priorYearLines.get(ref.key) ?? null;
      if (byVersion.every((b) => !b.line) && !priorYear) return null;
      return { kind: "line", key: ref.key, byVersion, priorYear };
    }
    case "version": {
      const v = index.versions.get(ref.id);
      if (!v) return null;
      // Everything but the 600-odd lines, which have their own records.
      const summary: Record<string, unknown> = { ...v, line_count: v.lines.length };
      delete summary.lines;
      return { kind: "generic", title: "Return " + v.version, subtitle: v.trigger, data: summary };
    }
    case "questionnaire": {
      const q = index.questionnaire.get(ref.id);
      return q ? { kind: "generic", title: q.question, subtitle: `Questionnaire answer ${q.id}`, data: q } : null;
    }
    case "message": {
      const m = index.messages.get(ref.id);
      return m ? { kind: "generic", title: `Message from ${m.from}`, subtitle: m.id, data: m } : null;
    }
    case "call": {
      const c = index.callNotes.get(ref.id);
      return c ? { kind: "generic", title: `Call notes ${c.id}`, subtitle: c.participants.join(", "), data: c } : null;
    }
    case "staff": {
      const s = index.staff.get(ref.id);
      return s ? { kind: "generic", title: s.name, subtitle: `Staff ${s.id}`, data: s } : null;
    }
    case "client_user": {
      const c = packet.firm.client_users.find((u) => u.id === ref.id);
      return c ? { kind: "generic", title: c.name, subtitle: `Client user ${c.id}`, data: c } : null;
    }
    case "person": {
      const p = index.people.get(ref.id);
      return p ? { kind: "generic", title: p.name, subtitle: `Household ${p.role}`, data: p } : null;
    }
    case "asset": {
      const a = index.assets.get(ref.id);
      if (a) return { kind: "generic", title: a.description, subtitle: `Asset ${a.asset_id} (${index.latestVersion})`, data: a };
      const prior = index.priorAssets.get(ref.id);
      return prior
        ? { kind: "generic", title: prior.description, subtitle: `Asset ${prior.asset_id} (prior-year record)`, data: prior }
        : null;
    }
    case "timeline": {
      const t = index.timeline.get(ref.id);
      return t ? { kind: "generic", title: t.event.replace(/_/g, " "), subtitle: `Timeline ${t.id}`, data: t } : null;
    }
    case "notice": {
      const n = packet.tax_agency_records.notices.find((x) => x.id === ref.id);
      return n ? { kind: "generic", title: `${n.agency} ${n.type}`, subtitle: n.id, data: n } : null;
    }
    case "prior_year": {
      const data = resolvePointer(packet.prior_years, ref.pointer);
      return data === undefined ? null : { kind: "generic", title: "Prior year record", subtitle: `py:${ref.pointer}`, data };
    }
    case "agency": {
      const data = resolvePointer(packet.tax_agency_records, ref.pointer);
      return data === undefined ? null : { kind: "generic", title: "Tax agency record", subtitle: `agency:${ref.pointer}`, data };
    }
    case "engine_param": {
      const data = resolveDotted(packet.engine_reference.parameters, ref.path);
      return data === undefined ? null : { kind: "generic", title: "Engine parameter", subtitle: ref.path, data };
    }
    case "unknown":
      return null;
  }
}
