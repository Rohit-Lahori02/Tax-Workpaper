import type { Check, Finding } from "./types";

const LOW_CONFIDENCE = 0.8;

const lowConfidence: Check = {
  id: "low-confidence",
  area: "documents",
  title: "Return lines resting on low-confidence reads",
  coverage: (ctx) => {
    const cited = new Set([...ctx.lines.values()].flatMap((l) => l.sources.filter((s) => s.startsWith("ev-"))));
    return cited.size + " extracted values cited by the return were screened for read confidence below " + LOW_CONFIDENCE * 100 + "%.";
  },
  run: (ctx) => {
    const out: Finding[] = [];
    const seen = new Set<string>();
    for (const l of ctx.lines.values()) {
      for (const s of l.sources) {
        const v = ctx.value(s);
        if (!v || v.confidence >= LOW_CONFIDENCE || seen.has(v.id)) continue;
        seen.add(v.id);
        const users = ctx.index.linesByValue.get(v.id)?.filter((x) => x.version === ctx.version.version).map((x) => x.key) ?? [];
        out.push({
          id: "low-confidence:" + v.id,
          check: "low-confidence",
          area: "documents",
          severity: "warning",
          title: v.label + " was read at " + Math.round(v.confidence * 100) + "% confidence",
          detail: "The pipeline read \"" + v.text_as_read + "\" on " + v.document_id + " page " + v.page + " and it feeds " + users.join(", ") + ". Confirm it against the page before relying on it.",
          refs: [v.id, v.document_id, ...users],
        });
      }
    }
    return out;
  },
};

const supersededSources: Check = {
  id: "superseded-sources",
  area: "documents",
  title: "No line still cites a superseded document",
  coverage: (ctx) => {
    const superseded = [...ctx.index.documentUsage.entries()].filter(([, u]) => u.supersededIn.length).map(([id]) => id);
    return "Documents marked superseded (" + (superseded.join(", ") || "none") + ") were checked for lines in " + ctx.version.version + " that still cite their values.";
  },
  run: (ctx) => {
    const out: Finding[] = [];
    for (const l of ctx.lines.values()) {
      const stale = l.sources.filter((s) => {
        const v = ctx.value(s);
        return v && (ctx.index.documentUsage.get(v.document_id)?.supersededIn.length ?? 0) > 0;
      });
      if (stale.length) {
        const docs = [...new Set(stale.map((s) => ctx.value(s)!.document_id))];
        out.push({
          id: "superseded-sources:" + l.key,
          check: "superseded-sources",
          area: "documents",
          severity: "error",
          title: l.key + " still cites superseded " + docs.join(", "),
          detail: l.label + " uses values from a document that a corrected version replaced.",
          refs: [l.key, ...docs, ...stale],
        });
      }
    }
    return out;
  },
};

const duplicateDocuments: Check = {
  id: "duplicate-documents",
  area: "documents",
  title: "Duplicate images of the same document",
  coverage: (ctx) => ctx.packet.documents.length + " documents were compared by issuer, owner, type and identifying field values.",
  run: (ctx) => {
    const out: Finding[] = [];
    const docs = ctx.packet.documents;
    const fingerprint = (id: string) => {
      const values = ctx.index.valuesByDocument.get(id) ?? [];
      const key = values
        .filter((v) => /^(employer_ein|box1|box2|box1a|account|payer_tin)$/.test(v.field))
        .map((v) => v.field + "=" + String(v.value))
        .sort()
        .join("|");
      return key;
    };
    for (let i = 0; i < docs.length; i++) {
      for (let j = i + 1; j < docs.length; j++) {
        const a = docs[i];
        const b = docs[j];
        if (a.document_type !== b.document_type || a.issuer !== b.issuer || a.belongs_to !== b.belongs_to || a.tax_year !== b.tax_year) continue;
        if (a.marked_corrected || b.marked_corrected) continue;
        const fa = fingerprint(a.id);
        if (!fa || fa !== fingerprint(b.id)) continue;
        const ua = ctx.index.documentUsage.get(a.id)!;
        const ub = ctx.index.documentUsage.get(b.id)!;
        const bothReach = [a.id, b.id].filter((id) => ctx.index.documentUsage.get(id)!.linesReached.some((l) => l.version === ctx.version.version));
        out.push({
          id: "duplicate-documents:" + a.id + ":" + b.id,
          check: "duplicate-documents",
          area: "documents",
          severity: bothReach.length > 1 ? "error" : "info",
          title: a.id + " and " + b.id + " are the same " + a.document_type,
          detail:
            "Both are a " +
            a.document_type +
            " from " +
            a.issuer +
            " with identical identifying values. " +
            (bothReach.length > 1
              ? "Both feed the return, so the amounts are counted twice."
              : "Only " + (bothReach[0] ?? "neither") + " feeds the return, so nothing is double counted; the other should be marked as a duplicate image.") +
            " Used in: " +
            a.id +
            " " +
            (ua.usedIn.join(", ") || "none") +
            "; " +
            b.id +
            " " +
            (ub.usedIn.join(", ") || "none") +
            ".",
          refs: [a.id, b.id],
        });
      }
    }
    return out;
  },
};

const unreadPages: Check = {
  id: "unread-pages",
  area: "documents",
  title: "Every page of every document was read",
  coverage: (ctx) => ctx.packet.documents.length + " documents were checked for pages the pipeline skipped and for extraction marked partial.",
  run: (ctx) => {
    const out: Finding[] = [];
    for (const d of ctx.packet.documents) {
      if (d.extraction.status !== "partial") continue;
      const pagesWithValues = new Set((ctx.index.valuesByDocument.get(d.id) ?? []).map((v) => v.page));
      const unread = d.pages.filter((p) => !pagesWithValues.has(p.page) && p.printed_content.trim().length > 0).map((p) => p.page);
      out.push({
        id: "unread-pages:" + d.id,
        check: "unread-pages",
        area: "documents",
        severity: (ctx.index.documentUsage.get(d.id)?.supersededIn.length ?? 0) > 0 ? "info" : "warning",
        title: d.id + " was only partially read",
        detail: (d.extraction.reason ?? "The pipeline marked extraction partial.") + (unread.length ? " Pages with printed content but no extracted values: " + unread.join(", ") + "." : ""),
        refs: [d.id, ...unread.map((p) => "doc:" + d.id + "#page" + p)],
      });
    }
    return out;
  },
};

export const documentChecks: Check[] = [lowConfidence, supersededSources, duplicateDocuments, unreadPages];
