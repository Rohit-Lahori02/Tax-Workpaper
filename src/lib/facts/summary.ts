import { DISPOSITION_LABELS, JUDGMENT_LABELS, KIND_LABELS, type Disposition, type FactKind, type FactView, type JudgmentType } from "./types";

/**
 * One line of plain words for any ledger record, for activity feeds. Pure;
 * never falls back to raw JSON, because a reviewer should not have to read it.
 */

const money = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(v ?? ""));
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function factSummary(f: FactView): string {
  const b = f.body;
  switch (f.kind) {
    case "verification":
      return str(b.type).replace(/_/g, " ") + (b.note ? " · " + str(b.note) : "");
    case "note":
      return (b.blocking ? "[blocks filing] " : "") + str(b.text);
    case "question":
      return "to " + (b.to === "client" ? "the client" : str(b.to)) + ": " + str(b.text);
    case "answer":
      return (b.onBehalf ? "(recorded for the client) " : "") + str(b.text);
    case "attachment":
      return str(b.name) || "file";
    case "retract":
      return "retracted an earlier record" + (b.reason ? ": " + str(b.reason) : "");
    case "resolve":
      return "resolved a note" + (b.text ? ": " + str(b.text) : "");
    case "sensitive_view":
      return "viewed unmasked: " + (Array.isArray(b.fields) ? (b.fields as string[]).join(", ") : "");
    case "adjustment":
      return money(b.engineValue) + " → " + money(b.newValue) + ": " + str(b.reason) + (b.authority ? " (" + str(b.authority) + ")" : "");
    case "seen":
      return "caught up through record " + String(b.seq ?? "");
    case "judgment": {
      const t = JUDGMENT_LABELS[b.type as JudgmentType] ?? str(b.type);
      return t + (b.choice ? " · " + str(b.choice) : "") + (b.status ? " · " + str(b.status).replace(/_/g, " ") : "") + ": " + str(b.text) + (b.authority ? " (" + str(b.authority) + ")" : "");
    }
    case "disposition":
      return (DISPOSITION_LABELS[b.disposition as Disposition] ?? str(b.disposition)) + (b.text ? ": " + str(b.text) : "");
    case "step":
      return (b.done ? "marked complete" : "reopened") + (b.text ? ": " + str(b.text) : "");
    case "signoff":
      return "signed at the " + str(b.level) + " level" + (b.text ? ": " + str(b.text) : "") + " · fingerprint " + str(b.hash).slice(0, 10);
    case "assignment":
      return str(b.role) + " → " + str(b.assigneeId) + (b.due ? " · due " + str(b.due) : "") + (b.text ? ": " + str(b.text) : "");
    case "approval_request":
      return "sent the return for approval · fingerprint " + str(b.hash).slice(0, 10) + (b.message ? ": " + str(b.message) : "");
    case "approval":
      return str(b.signerName) + " signed Form 8879 · PIN ending " + str(b.pinHint) + " · federal " + money(b.federalBalance) + ", California " + money(b.californiaBalance);
    case "filing":
      return filingSummary(b);
    case "correction":
      return "corrected " + str(b.field).toUpperCase() + " from " + str(b.evidence) + (b.text ? ": " + str(b.text) : "");
    case "standard":
      return str(b.key).replace(/_/g, " ") + " → " + (Array.isArray(b.value) ? (b.value as unknown[]).length + " items" : typeof b.value === "object" && b.value ? Object.keys(b.value as object).length + " entries" : String(b.value)) + ": " + str(b.text);
    case "time":
      return money(b.hours) + " h on " + str(b.date) + (b.text ? ": " + str(b.text) : "");
    default:
      return KIND_LABELS[f.kind as FactKind] ?? f.kind;
  }
}

function filingSummary(b: Record<string, unknown>): string {
  switch (b.event) {
    case "extension":
      return str(b.form) + " filed with a payment of " + money(b.payment) + (b.text ? ": " + str(b.text) : "");
    case "transmit":
      return (b.kind === "amended" ? "amended return" : "return") + " transmitted · submission " + str(b.submissionId) + " · " + str(b.version) + (Number(b.adjustments) ? " +" + String(b.adjustments) : "");
    case "ack":
      return "agency " + str(b.status) + (Array.isArray(b.errors) && b.errors.length ? ": " + (b.errors as { code: string }[]).map((e) => e.code).join(", ") : "");
    case "amendment":
      return "amendment opened: " + str(b.reason);
    case "notice_response":
      return "response to " + str(b.noticeId) + " sent · " + String(b.items ?? "") + " items, " + (Array.isArray(b.exhibits) ? (b.exhibits as unknown[]).length : 0) + " exhibits";
    case "rollforward":
      return "rolled forward to " + String(b.toYear) + (Array.isArray(b.openItems) && (b.openItems as unknown[]).length ? " · " + (b.openItems as unknown[]).length + " open items carried" : "");
    default:
      return "filing record";
  }
}

/** A readable name for targets that are not packet references. */
export function targetLabel(target: string): { label: string; kind: string } | null {
  const [prefix, ...rest] = target.split(":");
  const id = rest.join(":");
  switch (prefix) {
    case "return":
      return { label: "Whole return", kind: "scope" };
    case "area":
      return { label: id.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) + " area", kind: "scope" };
    case "standard":
      return { label: "Firm standard: " + id.replace(/_/g, " "), kind: "standard" };
    case "filing":
      return { label: (id === "federal" ? "Federal" : id === "california" ? "California" : id) + " filing", kind: "filing" };
    case "person":
      return { label: "Household member " + id, kind: "person" };
    case "notice":
      return { label: "Notice " + id, kind: "notice" };
    case "year":
      return { label: "Tax year " + id + " roll-forward", kind: "filing" };
    case "check":
      return { label: "Check finding " + id, kind: "check" };
    case "step":
      return { label: "Required step " + (Number(id) + 1), kind: "step" };
    case "decision":
    case "diag":
    case "dd":
    case "basis":
      return { label: prefix === "dd" ? "Due diligence " + id : prefix === "diag" ? "Engine diagnostic " + id : prefix === "basis" ? "Basis record " + id.replace(/:/g, " ") : "Decision " + id, kind: "judgment" };
    case "fact":
      return { label: "Adjustment approval", kind: "approval" };
    default:
      return target.startsWith("/") ? { label: "Page " + target, kind: "page" } : null;
  }
}
