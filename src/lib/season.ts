import type { EffectiveReturn } from "@/lib/effective";
import type { Ledger } from "@/lib/facts/ledger";
import { KIND_LABELS, type FactView } from "@/lib/facts/types";
import type { PacketIndex } from "@/lib/packet/index";
import type { Packet } from "@/lib/packet/schema";

/**
 * The filing season as data: the engagement's timeline merged with the
 * ledger, the filing lifecycle (extension, transmission, acknowledgment,
 * amendment) projected from filing facts, the simulated agency, and the
 * post-filing arithmetic the engine leaves to people. Pure over
 * packet + ledger; nothing here touches a database or a clock unless a
 * "now" is passed in.
 */

export type Jurisdiction = "federal" | "california";
export const JURISDICTIONS: Jurisdiction[] = ["federal", "california"];
export const JURISDICTION_LABELS: Record<Jurisdiction, string> = { federal: "Federal (IRS)", california: "California (FTB)" };
export const filingTarget = (j: Jurisdiction) => "filing:" + j;

/** Lines frozen into a transmission so the amended return and the client copy can show "as filed". */
export const FILED_LINE_KEYS = [
  "F1040.1a",
  "F1040.9",
  "F1040.10",
  "F1040.11",
  "F1040.12",
  "F1040.15",
  "F1040.16",
  "F1040.24",
  "F1040.25d",
  "F1040.26",
  "F1040.33",
  "F1040.37",
  "F1040.38",
  "SchA.14",
  "SchA.17",
  "SchC.1",
  "SchC.31",
  "SchD.16",
  "F8283.A1.vehicle",
  "F540NR.17",
  "F540NR.32",
  "F540NR.35",
  "F540NR.64",
  "F540NR.78",
  "F540NR.97",
];

export const FILED_LINE_LABELS: Record<string, string> = {
  "F1040.1a": "Wages",
  "F1040.9": "Total income",
  "F1040.10": "Adjustments to income",
  "F1040.11": "Adjusted gross income",
  "F1040.12": "Itemized deductions",
  "F1040.15": "Taxable income",
  "F1040.16": "Tax",
  "F1040.24": "Total tax",
  "F1040.25d": "Withholding",
  "F1040.26": "Estimated payments",
  "F1040.33": "Total payments",
  "F1040.37": "Amount you owe",
  "F1040.38": "Estimated tax penalty",
  "SchA.14": "Gifts to charity",
  "SchA.17": "Total itemized deductions",
  "SchC.1": "Schedule C gross receipts",
  "SchC.31": "Schedule C net profit",
  "SchD.16": "Net capital gain or loss",
  "F8283.A1.vehicle": "Form 8283: vehicle gift",
  "F540NR.17": "Total AGI under California law",
  "F540NR.32": "California AGI",
  "F540NR.35": "California taxable income",
  "F540NR.64": "California total tax",
  "F540NR.78": "California total payments",
  "F540NR.97": "California overpaid tax",
};

// ---------------------------------------------------------------------------
// Filing lifecycle
// ---------------------------------------------------------------------------

export type TransmissionStatus = "transmitted" | "accepted" | "rejected" | "held";

export interface Transmission {
  fact: FactView;
  jurisdiction: Jurisdiction;
  kind: "original" | "amended";
  submissionId: string;
  ack: FactView | null;
  status: TransmissionStatus;
  errors: { code: string; message: string }[];
}

export interface JurisdictionFiling {
  jurisdiction: Jurisdiction;
  extension: FactView | null;
  transmissions: Transmission[];
  /** The newest transmission, whatever its state. */
  current: Transmission | null;
  /** The newest accepted transmission: the return of record. */
  accepted: Transmission | null;
}

export type FilingPhase = "preparing" | "transmitted" | "rejected" | "filed" | "amending" | "amended";

export interface FilingState {
  federal: JurisdictionFiling;
  california: JurisdictionFiling;
  phase: FilingPhase;
  /** True when numbers may not change: a transmission is in flight or accepted and no amendment is open. */
  frozen: boolean;
  /** The open amendment, if any (opened and not yet transmitted and accepted). */
  amendment: FactView | null;
  /** The federal return of record (accepted original or accepted amendment). */
  asFiled: Transmission | null;
  /** Adjustments after the return of record belong to the amendment layer. */
  amendmentFromSeq: number | null;
}

function transmissionsOf(ledger: Ledger, j: Jurisdiction): Transmission[] {
  const list = (ledger.byTarget.get(filingTarget(j)) ?? []).filter((f) => f.kind === "filing" && !f.retracted);
  const out: Transmission[] = [];
  for (const f of list) {
    if (f.body.event !== "transmit") continue;
    const ack = list.filter((a) => a.body.event === "ack" && a.body.transmissionId === f.id).at(-1) ?? null;
    const status = (ack ? String(ack.body.status) : "transmitted") as TransmissionStatus;
    out.push({
      fact: f,
      jurisdiction: j,
      kind: f.body.kind === "amended" ? "amended" : "original",
      submissionId: String(f.body.submissionId ?? ""),
      ack,
      status,
      errors: ack && Array.isArray(ack.body.errors) ? (ack.body.errors as { code: string; message: string }[]) : [],
    });
  }
  return out;
}

export function filingState(ledger: Ledger): FilingState {
  const per = JURISDICTIONS.map((j) => {
    const transmissions = transmissionsOf(ledger, j);
    const extension = (ledger.byTarget.get(filingTarget(j)) ?? []).filter((f) => f.kind === "filing" && !f.retracted && f.body.event === "extension").at(-1) ?? null;
    return {
      jurisdiction: j,
      extension,
      transmissions,
      current: transmissions.at(-1) ?? null,
      accepted: transmissions.filter((t) => t.status === "accepted").at(-1) ?? null,
    } satisfies JurisdictionFiling;
  });
  const federal = per[0];
  const california = per[1];
  const amendments = (ledger.byTarget.get(filingTarget("federal")) ?? []).filter((f) => f.kind === "filing" && !f.retracted && f.body.event === "amendment");
  const lastAmendment = amendments.at(-1) ?? null;
  // An amendment stays open until an amended transmission after it is accepted.
  const amendedAfter = lastAmendment ? federal.transmissions.find((t) => t.kind === "amended" && t.fact.seq > lastAmendment.seq) : undefined;
  const amendmentOpen = lastAmendment && (!amendedAfter || amendedAfter.status === "rejected") ? lastAmendment : null;

  // The state return rides on the federal one: a federal rejection unfreezes everything, a held state return does not freeze anything on its own.
  const lead = federal.current ?? california.current;
  const inFlight = Boolean(lead && (lead.status === "transmitted" || lead.status === "accepted"));
  const frozen = inFlight && !amendmentOpen;

  let phase: FilingPhase = "preparing";
  const cur = federal.current;
  if (cur) {
    if (cur.kind === "amended") phase = cur.status === "accepted" ? "amended" : cur.status === "rejected" ? "amending" : "transmitted";
    else if (cur.status === "accepted") phase = "filed";
    else if (cur.status === "rejected") phase = "rejected";
    else phase = "transmitted";
  }
  if (amendmentOpen && !(cur && cur.kind === "amended" && cur.status === "transmitted")) phase = "amending";

  const asFiled = federal.accepted;
  return {
    federal,
    california,
    phase,
    frozen,
    amendment: amendmentOpen,
    asFiled,
    amendmentFromSeq: asFiled ? asFiled.fact.seq : null,
  };
}

export const PHASE_LABELS: Record<FilingPhase, string> = {
  preparing: "In preparation",
  transmitted: "Transmitted, awaiting acknowledgment",
  rejected: "Rejected by the agency",
  filed: "Filed and accepted",
  amending: "Amendment open",
  amended: "Amended return accepted",
};

/** Why a change to the return is refused right now, or null when it is allowed. */
export function frozenReason(state: FilingState): string | null {
  if (!state.frozen) return null;
  const cur = state.federal.current ?? state.california.current;
  if (cur && cur.status === "transmitted") return "The return has been transmitted and is awaiting the agency's acknowledgment. Nothing changes until it is accepted or rejected.";
  return "The return is filed and frozen. Open an amendment on the Filing page to change it; the change becomes a Form 1040-X on top of the return of record.";
}

// ---------------------------------------------------------------------------
// The simulated agency
// ---------------------------------------------------------------------------

export interface IdentityMismatch {
  personId: string;
  name: string;
  field: string;
  entered: string;
  onDocument: string;
  evidence: string;
  documentId: string;
  /** The correction fact that resolves it, if any. */
  correction: FactView | null;
}

/** Hand-entered identity data checked against identity documents in the file; the firm's own typo check and the e-file database's. */
export function identityMismatches(packet: Packet, index: PacketIndex, ledger: Ledger): IdentityMismatch[] {
  const out: IdentityMismatch[] = [];
  for (const doc of packet.documents) {
    if (doc.document_type !== "identity_document") continue;
    const person = packet.household.people.find((p) => doc.belongs_to === "dependent:" + p.id || doc.belongs_to === p.id || doc.title.includes(p.name));
    if (!person) continue;
    for (const ev of packet.extracted_values) {
      if (ev.document_id !== doc.id || ev.field !== "ssn" || typeof ev.value !== "string") continue;
      const entered = person.ssn ?? "";
      if (entered.replace(/\D/g, "") === ev.value.replace(/\D/g, "")) continue;
      const correction = (ledger.byTarget.get("person:" + person.id) ?? []).filter((f) => f.kind === "correction" && !f.retracted && f.body.field === "ssn" && f.body.evidence === ev.id).at(-1) ?? null;
      out.push({ personId: person.id, name: person.name, field: "ssn", entered, onDocument: ev.value, evidence: ev.id, documentId: doc.id, correction });
    }
  }
  void index;
  return out;
}

export interface AgencyDecision {
  status: "accepted" | "rejected" | "held";
  errors: { code: string; message: string }[];
}

/**
 * What the e-file system will say about a transmission. Deterministic from the
 * data: the IRS matches each dependent's SSN and name control against its
 * database, so an uncorrected identity typo is a rejection; the state return
 * rides on the federal acknowledgment.
 */
export function agencyDecision(packet: Packet, index: PacketIndex, ledger: Ledger, t: Transmission, state: FilingState): AgencyDecision {
  if (t.jurisdiction === "federal") {
    const open = identityMismatches(packet, index, ledger).filter((m) => !m.correction || m.correction.seq > t.fact.seq);
    if (open.length) {
      return {
        status: "rejected",
        errors: open.map((m) => {
          const n = packet.household.people.filter((p) => p.role === "dependent").findIndex((p) => p.id === m.personId) + 1;
          return { code: "R0000-504-02", message: "Dependent's taxpayer identification number and name control must match the e-file database (dependent " + n + ": " + m.name + ")." };
        }),
      };
    }
    return { status: "accepted", errors: [] };
  }
  // California: held while the federal return is rejected or unacknowledged; accepted once the federal return is.
  const fed = state.federal.transmissions.filter((f) => f.kind === t.kind).at(-1);
  if (!fed || fed.status === "transmitted") return { status: "held", errors: [{ code: "STATE-HOLD", message: "State return held until the federal return is acknowledged." }] };
  if (fed.status === "rejected") return { status: "held", errors: [{ code: "STATE-HOLD", message: "State return held because the federal return was rejected." }] };
  return { status: "accepted", errors: [] };
}

/** A 20-digit submission id in the IRS format: EFIN, year, day of year, sequence. */
export function submissionId(efin: string, at: Date, sequence: number): string {
  const start = Date.UTC(at.getUTCFullYear(), 0, 0);
  const day = Math.floor((at.getTime() - start) / 86400000);
  return efin.padStart(6, "0").slice(0, 6) + String(at.getUTCFullYear()) + String(day).padStart(3, "0") + String(sequence % 10_000_000).padStart(7, "0");
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export type SeasonEventKind = "engagement" | "document" | "version" | "message" | "fact" | "agency" | "deadline" | "filing";

export interface SeasonEvent {
  id: string;
  at: string;
  kind: SeasonEventKind;
  title: string;
  detail: string | null;
  refs: string[];
  actor: string | null;
  /** Deadlines and scripted future events the file has not reached. */
  scheduled?: boolean;
}

const EVENT_TITLES: Record<string, string> = {
  engagement_signed: "Engagement letter signed",
  questionnaire_submitted: "Questionnaire submitted",
  client_marked_upload_complete: "Client marked uploads complete",
  return_computed: "Return computed",
  work_started: "Preparation started",
  irs_transcript_pulled: "IRS transcript pulled",
  document_received: "Document received",
  staff_joined_engagement: "Staff joined the engagement",
  client_call: "Call with the client",
  extension_filed_with_payment: "Extension filed with payment",
  client_message: "Message from the client",
  client_approved_and_signed_8879: "Client approved and signed Form 8879",
  efile_rejected: "E-file rejected",
  efile_accepted_federal: "Federal e-file accepted",
  efile_accepted_california: "California e-file accepted",
  federal_balance_paid: "Federal balance paid",
  california_refund_issued: "California refund issued",
  quality_review_selected_return: "Selected for quality review",
  next_year_engagement_started: "Next year's engagement opened",
  notice_received: "Notice received",
};

const FILING_KINDS = new Set(["extension_filed_with_payment", "efile_rejected", "efile_accepted_federal", "efile_accepted_california", "client_approved_and_signed_8879"]);
const AGENCY_KINDS = new Set(["federal_balance_paid", "california_refund_issued", "notice_received", "irs_transcript_pulled"]);

/** Everything that happened to this file, from the packet and the ledger, oldest first. */
export function seasonEvents(packet: Packet, ledger: Ledger): SeasonEvent[] {
  const out: SeasonEvent[] = [];
  const docById = new Map(packet.documents.map((d) => [d.id, d]));
  const staff = new Map(packet.firm.staff.map((s) => [s.id, s.name]));
  const covered = new Set<string>();

  for (const t of packet.timeline) {
    const docs = t.refs.filter((r) => docById.has(r));
    docs.forEach((d) => covered.add(d));
    const base = EVENT_TITLES[t.event] ?? t.event.replace(/_/g, " ");
    const title = t.event === "return_computed" ? base + " (" + t.refs.join(", ") + ")" : t.event === "document_received" ? base + ": " + docs.map((d) => docById.get(d)!.title).join("; ") : base;
    out.push({
      id: "tl:" + t.id,
      at: t.at,
      kind: FILING_KINDS.has(t.event) ? "filing" : AGENCY_KINDS.has(t.event) ? "agency" : t.event === "return_computed" ? "version" : t.event === "document_received" ? "document" : t.event === "client_message" ? "message" : "engagement",
      title,
      detail: t.detail,
      refs: t.refs,
      actor: t.actor ? (staff.get(t.actor) ?? t.actor) : null,
    });
  }
  for (const d of packet.documents) {
    if (covered.has(d.id)) continue;
    out.push({ id: "doc:" + d.id, at: d.received_at, kind: "document", title: "Document received: " + d.title, detail: d.uploaded_by === "client" ? "Uploaded by the client" : "Added by the firm", refs: [d.id], actor: null });
  }
  for (const m of packet.client.messages) {
    if (packet.timeline.some((t) => t.refs.includes(m.id))) continue;
    out.push({ id: "msg:" + m.id, at: m.sent_at, kind: "message", title: "Message from " + m.from, detail: m.text, refs: [m.id], actor: null });
  }
  for (const dl of packet.firm.deadlines) {
    out.push({ id: "dl:" + dl.date + ":" + dl.what, at: dl.date + "T23:59:00Z", kind: "deadline", title: "Deadline: " + dl.what, detail: null, refs: [], actor: null, scheduled: true });
  }
  for (const f of ledger.all) {
    if (["seen", "sensitive_view", "retract", "resolve", "answer"].includes(f.kind)) continue;
    const label = f.kind === "filing" ? filingTitle(f) : (KIND_LABELS[f.kind as keyof typeof KIND_LABELS] ?? f.kind) + " · " + f.target;
    out.push({ id: "fact:" + f.id, at: f.at, kind: f.kind === "filing" ? "filing" : "fact", title: label, detail: factDetail(f), refs: [f.target], actor: f.actorName });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

function filingTitle(f: FactView): string {
  const j = f.target.replace("filing:", "");
  const J = j === "federal" ? "Federal" : j === "california" ? "California" : j;
  switch (f.body.event) {
    case "extension":
      return J + " extension filed (" + String(f.body.form) + ")";
    case "transmit":
      return J + (f.body.kind === "amended" ? " amended return" : " return") + " transmitted";
    case "ack":
      return J + " e-file " + String(f.body.status);
    case "amendment":
      return "Amendment opened";
    case "notice_response":
      return "Notice response package sent (" + String(f.body.noticeId) + ")";
    case "rollforward":
      return "Rolled forward to " + String(f.body.toYear);
    default:
      return "Filing record";
  }
}

function factDetail(f: FactView): string | null {
  const b = f.body;
  if (typeof b.text === "string" && b.text) return b.text;
  if (typeof b.reason === "string" && b.reason) return b.reason;
  if (f.kind === "filing" && b.event === "ack" && Array.isArray(b.errors) && b.errors.length) return (b.errors as { code: string; message: string }[]).map((e) => e.code + ": " + e.message).join(" ");
  if (f.kind === "filing" && b.event === "transmit") return "Submission " + String(b.submissionId);
  if (f.kind === "verification") return String(b.type ?? "").replace(/_/g, " ");
  return null;
}

export interface AsOfState {
  now: string;
  documentsReceived: number;
  documentsTotal: number;
  version: string | null;
  versionComputedAt: string | null;
  factsRecorded: number;
  past: SeasonEvent[];
  future: SeasonEvent[];
  lastEvent: SeasonEvent | null;
  nextEvent: SeasonEvent | null;
  /** Filing milestones reached by the packet's scripted timeline or by the ledger. */
  milestones: { extension: boolean; transmitted: boolean; rejected: boolean; accepted: boolean; paid: boolean; notice: boolean };
}

/** What the file looked like at a moment: which documents had arrived, which return was current, what had been recorded. */
export function asOf(packet: Packet, ledger: Ledger, events: SeasonEvent[], now: string): AsOfState {
  const past = events.filter((e) => e.at <= now);
  const future = events.filter((e) => e.at > now);
  const versions = packet.return_versions.filter((v) => v.computed_at <= now);
  const v = versions.at(-1) ?? null;
  const has = (pred: (e: SeasonEvent) => boolean) => past.some(pred);
  const tl = (id: string) => (e: SeasonEvent) => e.id === "tl:" + id;
  const filing = (ev: string) => (e: SeasonEvent) => e.id.startsWith("fact:") && e.kind === "filing" && e.title.includes(ev);
  return {
    now,
    documentsReceived: packet.documents.filter((d) => d.received_at <= now).length,
    documentsTotal: packet.documents.length,
    version: v?.version ?? null,
    versionComputedAt: v?.computed_at ?? null,
    factsRecorded: ledger.all.filter((f) => f.at <= now).length,
    past,
    future,
    lastEvent: past.at(-1) ?? null,
    nextEvent: future[0] ?? null,
    milestones: {
      extension: has(tl("extension-2026-04-14")) || has(filing("extension")),
      transmitted: has(tl("tl-21")) || has(filing("transmitted")),
      rejected: has(tl("tl-21")) || has(filing("rejected")),
      accepted: has(tl("tl-23")) || has(filing("accepted")),
      paid: has(tl("tl-25")),
      notice: has(tl("tl-29")),
    },
  };
}

// ---------------------------------------------------------------------------
// Post-filing arithmetic the engine does not do
// ---------------------------------------------------------------------------

export interface LatePaymentEstimate {
  balance: number;
  dueDate: string;
  paidDate: string;
  days: number;
  /** Months or parts of months after the due date. */
  months: number;
  interest: number;
  penalty: number;
  total: number;
}

/** Interest and failure-to-pay penalty on a balance paid after the original due date. An extension to file is not an extension to pay. */
export function latePaymentEstimate(balance: number, dueDate: string, paidDate: string, rates: { interestAnnual: number; penaltyPerMonth: number }): LatePaymentEstimate {
  const due = Date.parse(dueDate);
  const paid = Date.parse(paidDate);
  const days = Math.max(0, Math.round((paid - due) / 86400000));
  const months = days === 0 ? 0 : Math.ceil(days / 30);
  const interest = balance > 0 ? Math.round(balance * rates.interestAnnual * (days / 365) * 100) / 100 : 0;
  const penalty = balance > 0 ? Math.round(balance * rates.penaltyPerMonth * months * 100) / 100 : 0;
  return { balance, dueDate, paidDate, days, months, interest, penalty, total: Math.round((interest + penalty) * 100) / 100 };
}

export interface EstimateRow {
  jurisdiction: Jurisdiction;
  due: string;
  share: number;
  amount: number;
}

export interface EstimatePlan {
  federal: { basis: number; safeHarbor: number; rows: EstimateRow[]; rule: string };
  california: { basis: number; safeHarbor: number; rows: EstimateRow[]; rule: string };
  changes: string[];
}

/** Next year's safe-harbor estimates from this year's total tax and the packet's planning reference. */
export function estimatePlan(packet: Packet, eff: EffectiveReturn): EstimatePlan {
  const pr = packet.planning_reference_2026 as Record<string, unknown>;
  const fedDates = (pr.federal_estimate_due_dates as string[]) ?? [];
  const caDates = (pr.california_estimate_due_dates as string[]) ?? [];
  const caShares = (pr.california_installment_percentages as number[]) ?? [];
  const fedTax = eff.workingSummary.federal.total_tax;
  const caTax = eff.workingSummary.california.total_tax;
  const fedSafe = Math.ceil(fedTax * 1.1);
  const caSafe = Math.ceil(caTax * 1.1);
  return {
    federal: {
      basis: fedTax,
      safeHarbor: fedSafe,
      rule: String(pr.federal_safe_harbor ?? ""),
      rows: fedDates.map((due) => ({ jurisdiction: "federal" as const, due, share: 1 / fedDates.length, amount: Math.ceil(fedSafe / fedDates.length) })),
    },
    california: {
      basis: caTax,
      safeHarbor: caSafe,
      rule: String(pr.california_safe_harbor ?? ""),
      rows: caDates.map((due, i) => ({ jurisdiction: "california" as const, due, share: caShares[i] ?? 1 / caDates.length, amount: Math.ceil(caSafe * (caShares[i] ?? 1 / caDates.length)) })),
    },
    changes: (pr.known_2026_changes_for_this_household as string[]) ?? [],
  };
}

// ---------------------------------------------------------------------------
// Carryforward
// ---------------------------------------------------------------------------

export interface CarryRow {
  id: string;
  jurisdiction: Jurisdiction;
  label: string;
  value: number | string;
  /** Where the number comes from on this year's return. */
  from: string[];
  /** Where it lands next year. */
  to: string;
  /** This year's opening figure, when the same item came in. */
  openedWith: number | null;
  note: string | null;
}

const CARRY_LABELS: Record<string, { label: string; from: string[]; to: string }> = {
  capital_loss_short: { label: "Short-term capital loss carryover", from: ["SchD.7"], to: "2026 Schedule D line 6" },
  capital_loss_long: { label: "Long-term capital loss carryover", from: ["SchD.15"], to: "2026 Schedule D line 14" },
  capital_loss: { label: "Capital loss carryover", from: ["SchD.16"], to: "2026 Schedule D (540NR)" },
  passive_1450_fremont: { label: "Suspended passive loss: 1450 Fremont", from: ["F8582.1c"], to: "2026 Form 8582 line 1c" },
  passive_1200_barton_hills: { label: "Suspended passive loss: 1200 Barton Hills", from: ["F8582.1c"], to: "2026 Form 8582 line 1c" },
  passive: { label: "Suspended passive loss (California)", from: ["F8582.1c"], to: "2026 FTB 3801" },
  minimum_tax_credit_from_2025_amt: { label: "Minimum tax credit from 2025 AMT", from: ["F6251.11"], to: "2026 Form 8801" },
  charitable: { label: "Charitable contribution carryover", from: ["SchA.14"], to: "2026 Schedule A" },
  section_179: { label: "Section 179 carryover", from: ["F4562-C.12"], to: "2026 Form 4562 line 10" },
  ira_nondeductible_basis_ngozi: { label: "Nondeductible IRA basis (Ngozi)", from: ["F8606.14"], to: "2026 Form 8606 line 2" },
  scorp_stock_basis_end: { label: "S corporation stock basis, end of year", from: ["F7203.15"], to: "2026 Form 7203 line 1" },
  ridgeline_capital_account_end: { label: "Ridgeline capital account, end of year", from: ["SchE.28A"], to: "2026 outside-basis worksheet" },
  sep_contribution_not_deductible_for_2025: { label: "SEP contribution not deductible for 2025", from: ["Sch1.16"], to: "2026 Schedule 1 line 16 (excess carried)" },
};

export function carryforwardRows(packet: Packet, index: PacketIndex): CarryRow[] {
  const v = index.versions.get(index.latestVersion)!;
  const into = packet.prior_years.carryovers_into_2025 as Record<string, unknown>;
  const intoCa = (into.california ?? {}) as Record<string, unknown>;
  const out: CarryRow[] = [];
  const push = (j: Jurisdiction, key: string, value: unknown, opened: unknown, note: string | null = null) => {
    if (typeof value !== "number" && typeof value !== "string") return;
    const meta = CARRY_LABELS[key] ?? { label: key.replace(/_/g, " "), from: [], to: "2026 return" };
    out.push({ id: j + ":" + key, jurisdiction: j, label: meta.label, value, from: meta.from.filter((k) => index.lines.get(v.version)?.has(k)), to: meta.to, openedWith: typeof opened === "number" ? opened : null, note });
  };
  for (const [k, val] of Object.entries(v.carryovers_out.federal)) push("federal", k, val, into[k]);
  for (const [k, val] of Object.entries(v.carryovers_out.california)) {
    if (k === "depreciation_basis_differences" && val && typeof val === "object") {
      for (const [asset, diff] of Object.entries(val as Record<string, number>)) {
        out.push({ id: "california:basis:" + asset, jurisdiction: "california", label: "California depreciation basis difference: " + asset, value: diff, from: ["asset:" + asset], to: "2026 FTB 3885A", openedWith: null, note: "Remaining California basis where federal bonus depreciation was not allowed." });
      }
      continue;
    }
    push("california", k, val, intoCa[k]);
  }
  return out;
}

export interface BasisGap {
  id: string;
  label: string;
  detail: string;
  refs: string[];
  /** A judgment or note on the gap's target counts as dealt with. */
  target: string;
}

/** Basis records the prior preparer left incomplete; they follow the file into next year unless closed. */
export function basisGaps(packet: Packet, ledger: Ledger): BasisGap[] {
  const out: BasisGap[] = [];
  const records = packet.prior_years.basis_records;
  for (const [name, rows] of Object.entries(records)) {
    for (const r of rows) {
      const missing = Object.entries(r).filter(([k, val]) => val === null && k !== "disposed").map(([k]) => k);
      if (!missing.length) continue;
      const target = "basis:" + name + ":" + String(r.year ?? r.event ?? "");
      if (ledger.summary(target).total > 0) continue;
      out.push({
        id: target,
        label: name.replace(/_/g, " ") + " " + String(r.year ?? ""),
        detail: missing.map((m) => m.replace(/_/g, " ")).join(", ") + " not established · " + String(r.source ?? ""),
        refs: [],
        target,
      });
    }
  }
  return out;
}
