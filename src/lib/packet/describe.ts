import { parseRef, resolveDotted, resolvePointer } from "@/lib/refs";
import { fmtExtractedValue, fmtLineValue } from "@/lib/format";
import type { PacketIndex } from "./index";
import type { Packet } from "./schema";

export interface RefDescription {
  /** Short human label, for example the line label or document title. */
  label: string;
  /** Secondary text such as the value or the document and page. */
  detail?: string;
}

/** A readable one-line description of any packet reference, for lists of evidence. */
export function describeRef(raw: string, packet: Packet, index: PacketIndex, version = index.latestVersion): RefDescription {
  const ref = parseRef(raw);
  switch (ref.kind) {
    case "value": {
      const v = index.values.get(ref.id);
      if (!v) return { label: raw, detail: "missing value" };
      const doc = index.documents.get(v.document_id);
      return { label: v.label, detail: fmtExtractedValue(v.value) + " · " + (doc?.title ?? v.document_id) + " p." + v.page };
    }
    case "document": {
      const d = index.documents.get(ref.id);
      return d ? { label: d.title, detail: d.issuer + (ref.page ? " · page " + ref.page : "") } : { label: raw };
    }
    case "line": {
      const l = index.lines.get(version)?.get(ref.key);
      if (l) return { label: l.label, detail: fmtLineValue(l.value) + " · " + version };
      const py = index.priorYearLines.get(ref.key);
      return py ? { label: py.label ?? ref.key, detail: fmtLineValue(py.value) + " · 2024" } : { label: raw };
    }
    case "version":
      return { label: "Return " + ref.id };
    case "questionnaire": {
      const q = index.questionnaire.get(ref.id);
      return q ? { label: q.question, detail: "Answer: " + q.answer } : { label: raw };
    }
    case "message": {
      const m = index.messages.get(ref.id);
      return m ? { label: "Message from " + m.from, detail: m.text } : { label: raw };
    }
    case "call": {
      const c = index.callNotes.get(ref.id);
      return c ? { label: "Call notes", detail: c.participants.join(", ") + " · " + c.date.slice(0, 10) } : { label: raw };
    }
    case "staff":
      return { label: index.staff.get(ref.id)?.name ?? raw };
    case "client_user":
      return { label: packet.firm.client_users.find((c) => c.id === ref.id)?.name ?? raw };
    case "person":
      return { label: index.people.get(ref.id)?.name ?? raw };
    case "asset": {
      const a = index.assets.get(ref.id) ?? index.priorAssets.get(ref.id);
      return a ? { label: a.description, detail: a.activity } : { label: raw };
    }
    case "timeline": {
      const t = index.timeline.get(ref.id);
      return t ? { label: t.event.replace(/_/g, " "), detail: t.at.slice(0, 10) + (t.detail ? " · " + t.detail : "") } : { label: raw };
    }
    case "notice": {
      const n = packet.tax_agency_records.notices.find((x) => x.id === ref.id);
      return n ? { label: n.agency + " " + n.type, detail: n.summary ?? n.dated } : { label: raw };
    }
    case "prior_year": {
      const v = resolvePointer(packet.prior_years, ref.pointer);
      return { label: "Prior year: " + ref.pointer.replace(/^\//, "").replace(/\//g, " › "), detail: typeof v === "object" ? undefined : String(v) };
    }
    case "agency": {
      const v = resolvePointer(packet.tax_agency_records, ref.pointer);
      const detail = v && typeof v === "object" && "amount" in (v as Record<string, unknown>) ? String((v as Record<string, unknown>).date) + " · " + String((v as Record<string, unknown>).description) + " · " + String((v as Record<string, unknown>).amount) : undefined;
      return { label: "Agency record: " + ref.pointer.replace(/^\//, "").replace(/\//g, " › "), detail };
    }
    case "engine_param": {
      const v = resolveDotted(packet.engine_reference.parameters, ref.path);
      return { label: "Engine parameter " + ref.path, detail: typeof v === "object" ? undefined : String(v) };
    }
    case "check":
      return { label: "Check finding", detail: ref.id };
    case "unknown":
      return { label: raw };
  }
}
