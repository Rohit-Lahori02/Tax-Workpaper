import type { CheckRun } from "@/lib/checks/run";
import type { Area } from "@/lib/checks/types";
import { activeAdjustments, type EffectiveReturn } from "@/lib/effective";
import type { Ledger } from "@/lib/facts/ledger";
import type { FactView } from "@/lib/facts/types";
import type { PacketIndex } from "@/lib/packet/index";
import type { Packet, PacketDocument } from "@/lib/packet/schema";
import { variance } from "@/lib/variance";
import { documentState, type DocumentState } from "@/lib/packet/documents";

/**
 * Judgment and completeness projections: what still needs a human decision,
 * and whether every document, area and outside filing has been dealt with.
 * Pure over packet + ledger + checks.
 */

// ---------- Variances ----------

export interface VarianceItem {
  key: string;
  form: string;
  label: string;
  prior: number;
  now: number;
  working: number | null;
  diff: number;
  pct: number | null;
  explanation: FactView | null;
}

export function varianceItems(packet: Packet, index: PacketIndex, ledger: Ledger, eff: EffectiveReturn): VarianceItem[] {
  const out: VarianceItem[] = [];
  for (const l of index.lines.get(eff.version)?.values() ?? []) {
    const prior = index.priorYearLines.get(l.key);
    if (!prior || typeof prior.value !== "number" || typeof l.value !== "number") continue;
    const v = variance(l.value, prior.value, packet);
    if (!v.flagged) continue;
    const w = eff.lines.get(l.key);
    const explanation = (ledger.byTarget.get(l.key) ?? []).filter((f) => f.kind === "judgment" && !f.retracted && f.body.type === "variance").at(-1) ?? null;
    out.push({
      key: l.key,
      form: l.form,
      label: l.label,
      prior: prior.value,
      now: l.value,
      working: w && w.kind !== "blocked" && typeof w.working === "number" ? w.working : null,
      diff: v.diff,
      pct: v.pct,
      explanation,
    });
  }
  out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return out;
}

// ---------- Decision points ----------

export interface DecisionOption {
  id: string;
  label: string;
  /** Total tax change (federal + California) versus the engine's choice, when known. */
  taxChange: number | null;
  penaltyChange: number | null;
  whatIfId: string | null;
}

export type DecisionKind = "election" | "judgment_call" | "penalty" | "diagnostic";

export interface DecisionPoint {
  id: string;
  target: string;
  kind: DecisionKind;
  title: string;
  context: string;
  refs: string[];
  options: DecisionOption[];
  recorded: FactView | null;
  /** The option currently in force: the recorded choice, or the engine's default. */
  current: string | null;
  adoptedWhatIf: string | null;
}

const CHOICE_TITLES: Record<string, { title: string; kind: DecisionKind; engineLabel: string; refs: string[] }> = {
  equipment: {
    title: "Studio equipment (38,000): how to recover the cost",
    kind: "election",
    engineLabel: "100% special depreciation in 2025 (engine default)",
    refs: ["F4562-C.14", "SchC.13", "asset:STU-PRINTER", "asset:STU-CAMERA", "asset:STU-WORKST", "call-01"],
  },
  hvac: {
    title: "Fremont Way HVAC replacement (11,000): repair or improvement",
    kind: "judgment_call",
    engineLabel: "Deducted as a repair in 2025 (engine default)",
    refs: ["SchE.14A", "D47", "call-01"],
  },
  deduction: {
    title: "Itemize or take the standard deduction",
    kind: "election",
    engineLabel: "Itemized deductions (engine default)",
    refs: ["F1040.12", "SchA.17", "ref:param.std_deduction_mfj"],
  },
  penalty_method: {
    title: "Underpayment penalty: regular or annualized method",
    kind: "penalty",
    engineLabel: "Regular method (engine default)",
    refs: ["F2210.19", "F2210.AI", "F1040.38"],
  },
};

const DIAGNOSTIC_KINDS: Record<string, DecisionKind | "skip"> = {
  FBAR_OUTSIDE_RETURN: "skip",
  FORM_1099_FILING: "skip",
  DUE_DILIGENCE_REQUIRED: "skip",
  DIGITAL_ASSET_BASIS_MISSING: "judgment_call",
  HOME_OFFICE_AREA_CHANGE: "judgment_call",
  CA_AMT_NOT_COMPUTED: "judgment_call",
  SCORP_BASIS_INCOMPLETE: "judgment_call",
};

export function decisionPoints(packet: Packet, index: PacketIndex, ledger: Ledger): DecisionPoint[] {
  const out: DecisionPoint[] = [];
  const adopted = new Map(activeAdjustments(ledger).filter((a) => a.whatIf).map((a) => [a.whatIf!, a]));

  const byChoice = new Map<string, typeof packet.what_if.alternatives>();
  for (const alt of packet.what_if.alternatives) {
    const key = Object.keys(alt.choices)[0] ?? alt.id;
    byChoice.set(key, [...(byChoice.get(key) ?? []), alt]);
  }
  for (const [key, alts] of byChoice) {
    const meta = CHOICE_TITLES[key] ?? { title: key.replace(/_/g, " "), kind: "judgment_call" as DecisionKind, engineLabel: "Engine default", refs: [] };
    const target = "decision:" + key;
    const recorded = ledger.latest(target, "judgment");
    const adoptedAlt = alts.find((a) => adopted.has(a.id));
    out.push({
      id: key,
      target,
      kind: meta.kind,
      title: meta.title,
      context: alts.map((a) => a.description).join(" / "),
      refs: meta.refs,
      options: [
        { id: "engine", label: meta.engineLabel, taxChange: 0, penaltyChange: 0, whatIfId: null },
        ...alts.map((a) => {
          const fed = a.federal as { total_tax_change?: number; penalty_change?: number };
          const ca = a.california as { total_tax_change?: number };
          return {
            id: a.id,
            label: a.description,
            taxChange: (fed.total_tax_change ?? 0) + (ca.total_tax_change ?? 0),
            penaltyChange: fed.penalty_change ?? null,
            whatIfId: a.id,
          };
        }),
      ],
      recorded,
      current: recorded && typeof recorded.body.choice === "string" ? recorded.body.choice : adoptedAlt ? adoptedAlt.id : "engine",
      adoptedWhatIf: adoptedAlt?.id ?? null,
    });
  }

  const latest = index.versions.get(index.latestVersion)!;
  for (const d of latest.diagnostics) {
    const kind = DIAGNOSTIC_KINDS[d.code] ?? "diagnostic";
    if (kind === "skip") continue;
    const target = "diag:" + d.code;
    out.push({
      id: d.code,
      target,
      kind,
      title: d.code.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
      context: d.message,
      refs: d.refs,
      options: [],
      recorded: ledger.latest(target, "judgment"),
      current: null,
      adoptedWhatIf: null,
    });
  }
  return out;
}

// ---------- Due diligence ----------

export interface DueDiligenceItem {
  id: string;
  credit: string;
  applicable: boolean;
  why: string;
  refs: string[];
  questions: string[];
  target: string;
  recorded: FactView | null;
}

export const DUE_DILIGENCE_QUESTIONS = [
  "Interviewed the taxpayer, asked the questions needed to determine eligibility, and documented the questions and answers",
  "Reviewed records that establish relationship, residency and support (school, medical or birth records), and listed them",
  "Computed the credit with the worksheet and kept the computation",
  "Nothing in the information seemed incorrect, inconsistent or incomplete; where it did, made and documented further inquiries",
  "Kept copies of the documents relied on for the required period",
];

export function dueDiligenceItems(packet: Packet, index: PacketIndex, ledger: Ledger): DueDiligenceItem[] {
  const lines = index.lines.get(index.latestVersion)!;
  const n = (k: string) => (typeof lines.get(k)?.value === "number" ? (lines.get(k)!.value as number) : 0);
  const items: Omit<DueDiligenceItem, "target" | "recorded">[] = [
    {
      id: "ctc",
      credit: "Child tax credit",
      applicable: n("F8812.5") > 0,
      why: n("F8812.5") > 0 ? "Schedule 8812 line 5 claims " + n("F8812.5") + " for a qualifying child under 17." : "No child tax credit claimed.",
      refs: ["F8812.5", "F8812.12", "household:theo", "D71", "F8867.status"],
      questions: DUE_DILIGENCE_QUESTIONS,
    },
    {
      id: "odc",
      credit: "Credit for other dependents",
      applicable: n("F8812.7") > 0,
      why: n("F8812.7") > 0 ? "Schedule 8812 line 7 claims " + n("F8812.7") + " for a dependent who is not a qualifying child (the college student)." : "No credit for other dependents claimed.",
      refs: ["F8812.7", "household:ada", "qa-04", "F8867.status"],
      questions: DUE_DILIGENCE_QUESTIONS,
    },
    {
      id: "aotc",
      credit: "American opportunity credit",
      applicable: n("F8863.7") > 0,
      why: n("F8863.7") > 0 ? "Form 8863 claims " + n("F8863.7") + "." : "Form 8863 was prepared but the credit phased out to zero at this income, so no due-diligence checklist is required. Keep the 1098-T.",
      refs: ["F8863.30", "F8863.7", "D59"],
      questions: DUE_DILIGENCE_QUESTIONS,
    },
    {
      id: "eic",
      credit: "Earned income credit",
      applicable: false,
      why: "Not claimed; income is far above the limit.",
      refs: ["F1040.11"],
      questions: DUE_DILIGENCE_QUESTIONS,
    },
    {
      id: "hoh",
      credit: "Head of household status",
      applicable: false,
      why: "Filing status is " + packet.household.filing_status.replace(/_/g, " ") + ".",
      refs: ["household:" + packet.household.people[0].id],
      questions: DUE_DILIGENCE_QUESTIONS,
    },
  ];
  return items.map((i) => ({ ...i, target: "dd:" + i.id, recorded: ledger.latest("dd:" + i.id, "judgment") }));
}

// ---------- Outside filings ----------

export interface OutsideFiling {
  id: string;
  title: string;
  owner: string;
  due: string | null;
  why: string;
  refs: string[];
  target: string;
  recorded: FactView | null;
}

export function outsideFilings(packet: Packet, index: PacketIndex, ledger: Ledger): OutsideFiling[] {
  const latest = index.versions.get(index.latestVersion)!;
  const deadline = (re: RegExp) => packet.firm.deadlines.find((d) => re.test(d.what))?.date ?? null;
  const diag = (code: string) => latest.diagnostics.find((d) => d.code === code);
  const items: Omit<OutsideFiling, "target" | "recorded">[] = [];

  const fbar = diag("FBAR_OUTSIDE_RETURN");
  if (fbar || lines(index, "F8938.req") === "Yes") {
    items.push({
      id: "fbar",
      title: "FinCEN Form 114 (FBAR) for the Swedish account",
      owner: "Client files directly; outside the engagement",
      due: deadline(/FBAR/i),
      why: fbar?.message ?? "A foreign account over the reporting threshold appears on Form 8938.",
      refs: ["F8938.1.max", "D36", "py:/prior_preparer_workpaper/notes/2"],
    });
  }
  const nec = diag("FORM_1099_FILING");
  if (nec) {
    items.push({
      id: "forms-1099-nec",
      title: "Forms 1099-NEC for the studio's two contractors",
      owner: "Client's business must issue; the firm advises",
      due: deadline(/1099-NEC/i),
      why: nec.message + " The client asked on the call what to do.",
      refs: ["SchC.I", "SchC.J", "D27", "call-01"],
    });
  }
  const open = packet.prior_years.prior_preparer_workpaper.open_items_left_by_prior_preparer;
  const f3520 = open.findIndex((o) => /3520/.test(o));
  if (f3520 >= 0) {
    items.push({
      id: "form-3520",
      title: "Form 3520 for the 2023 foreign inheritance",
      owner: "Prior preparer left it open; needs a decision",
      due: null,
      why: open[f3520],
      refs: ["py:/prior_preparer_workpaper/open_items_left_by_prior_preparer/" + f3520, "D07", "D36"],
    });
  }
  for (const r of packet.household.related_returns) {
    if (/composite/i.test(r.return)) {
      const state = /Oregon/i.test(r.return) ? "Oregon" : /Arizona/i.test(r.return) ? "Arizona" : "state";
      items.push({
        id: "composite-" + state.toLowerCase(),
        title: state + " composite return for " + r.who,
        owner: r.prepared_by,
        due: null,
        why: r.return + ". " + (typeof r.in_this_packet === "string" ? r.in_this_packet : "Not in this packet") + ".",
        refs: state === "Oregon" ? ["ScheduleS.credit", "ev-0982", "D39"] : ["D37", "D38", "SchE.28B"],
      });
    } else if (!r.in_this_packet) {
      items.push({
        id: "related-" + r.who.split(" ")[0].toLowerCase(),
        title: r.who + ": " + r.return.split(" (")[0],
        owner: r.prepared_by,
        due: null,
        why: r.return + " The dependent claim on this return must agree with what she filed.",
        refs: ["household:ada", "F8812.7", "qa-04"],
      });
    }
  }
  return items.map((i) => ({ ...i, target: "filing:" + i.id, recorded: ledger.latest("filing:" + i.id, "judgment") }));
}

function lines(index: PacketIndex, key: string): unknown {
  return index.lines.get(index.latestVersion)?.get(key)?.value;
}

// ---------- Areas ----------

export interface AreaDef {
  id: string;
  label: string;
  match: (key: string) => boolean;
  docTypes: string[];
  checkAreas: Area[];
}

export const AREA_DEFS: AreaDef[] = [
  { id: "intake_and_engagement", label: "Intake and engagement", match: () => false, docTypes: ["engagement_letter", "consent_7216", "irs_ip_pin_notice", "identity_document", "prior_year_return", "prior_workpaper", "irs_transcript"], checkAreas: ["documents", "arithmetic", "sources"] },
  { id: "wages_and_stock_compensation", label: "Wages and stock compensation", match: (k) => /^(F1040\.1[a-z]?$|Sch3\.11$|F6251\.|F8959\.)/.test(k), docTypes: ["W-2", "paystub", "3921", "3922", "stock_plan_supplement"], checkAreas: ["wages"] },
  { id: "investments_and_digital_assets", label: "Investments and digital assets", match: (k) => /^(SchB\.|SchD\.|F8949\.|F8960\.|F8938|F1040\.(2b|3[ab]|7)$)/.test(k), docTypes: ["1099-INT", "1099-DA", "1099-composite", "transaction_export", "foreign_bank_statement"], checkAreas: ["investments", "foreign"] },
  { id: "business", label: "Business (Schedule C)", match: (k) => /^(SchC\.|SchSE\.|Sch1\.(3|1[5-7])$|F4562-C|F8995)/.test(k), docTypes: ["books_profit_loss", "books_transaction_detail", "books_report", "1099-NEC", "1099-K", "mileage_log", "invoice", "insurance_statement", "retirement_contribution"], checkAreas: ["business"] },
  { id: "rentals_and_sale", label: "Rentals and the sale", match: (k) => /^(SchE\.(?!28)|F4797\.|F8582\.|F4562-E)/.test(k), docTypes: ["rental_owner_statement", "rental_ledger", "closing_statement_seller", "1099-S", "property_tax_bill", "1098"], checkAreas: ["rentals"] },
  { id: "pass_throughs_and_basis", label: "Pass-throughs and basis", match: (k) => /^(SchE\.28|F7203\.)/.test(k), docTypes: ["K-1-1065", "K-1-1120S", "K-1-state-supplement", "5498", "1099-R"], checkAreas: ["carryovers"] },
  { id: "deductions_and_credits", label: "Deductions, credits and payments", match: (k) => /^(SchA\.|F8812\.|F8863\.|F2441\.|F8889\.|F8606\.|F8283\.|Sch3\.(?!11)|F2210\.|F8867|F1040\.(1[2-9]|2\d|3\d)[a-z]?$)/.test(k), docTypes: ["1098-T", "1098-C", "donation_receipt", "dependent_care_statement", "1099-SA", "5498-SA", "property_tax_receipt", "payoff_statement", "closing_statement_buyer", "payment_confirmation"], checkAreas: ["deductions", "payments"] },
  { id: "california", label: "California", match: (k) => /^(SchCA540NR|F540NR|ScheduleS|FTB)/.test(k), docTypes: [], checkAreas: ["state"] },
  { id: "partner_review", label: "Partner review", match: () => false, docTypes: [], checkAreas: [] },
];

export interface AreaStatus {
  id: string;
  label: string;
  budgetHours: number;
  lines: number;
  verified: number;
  checkErrors: number;
  checkErrorsResolved: number;
  openQuestions: number;
  blocking: number;
  documents: number;
  reviewed: FactView | null;
  target: string;
}

export function areaStatuses(packet: Packet, index: PacketIndex, ledger: Ledger, checks: CheckRun): AreaStatus[] {
  const lineList = [...(index.lines.get(index.latestVersion)?.values() ?? [])];
  const resolved = resolvedFindingIds(ledger);
  return AREA_DEFS.map((a) => {
    const keys = lineList.filter((l) => a.match(l.key)).map((l) => l.key);
    const sums = keys.map((k) => ledger.summary(k));
    const errors = checks.findings.filter((f) => f.severity === "error" && a.checkAreas.includes(f.area));
    return {
      id: a.id,
      label: a.label,
      budgetHours: packet.firm.budget_hours[a.id] ?? 0,
      lines: keys.length,
      verified: sums.filter((s) => s.verifications.length > 0).length,
      checkErrors: errors.length,
      checkErrorsResolved: errors.filter((f) => resolved.has(f.id)).length,
      openQuestions: sums.reduce((n, s) => n + s.openQuestions, 0),
      blocking: sums.reduce((n, s) => n + s.blockingOpen, 0),
      documents: packet.documents.filter((d) => a.docTypes.includes(d.document_type)).length,
      reviewed: ledger.latest("area:" + a.id, "judgment"),
      target: "area:" + a.id,
    };
  });
}

/** A check finding counts as resolved once an adjustment was made from it or a judgment recorded on it. */
export function resolvedFindingIds(ledger: Ledger): Set<string> {
  const ids = new Set<string>();
  for (const a of activeAdjustments(ledger)) if (a.fromFinding?.startsWith("check:")) ids.add(a.fromFinding.slice(6));
  for (const f of ledger.all) {
    if (f.kind === "judgment" && !f.retracted && f.target.startsWith("check:")) ids.add(f.target.slice(6));
  }
  return ids;
}

// ---------- Documents ----------

export interface DocAccount {
  doc: PacketDocument;
  state: DocumentState;
  disposition: FactView | null;
  accounted: boolean;
}

export function documentAccounting(index: PacketIndex, ledger: Ledger): DocAccount[] {
  const out: DocAccount[] = [];
  for (const doc of index.documents.values()) {
    const state = documentState(doc, index, index.latestVersion);
    const disposition = ledger.latest(doc.id, "disposition");
    const dispositionOk = Boolean(disposition && disposition.body.disposition !== "pending");
    out.push({ doc, state, disposition, accounted: state === "reached" || state === "superseded" || dispositionOk });
  }
  out.sort((a, b) => Number(a.doc.id.slice(1)) - Number(b.doc.id.slice(1)));
  return out;
}

// ---------- Required steps ----------

export type StepAuto = "done" | "open" | "blocked" | "later" | null;

export interface StepStatus {
  index: number;
  label: string;
  target: string;
  auto: StepAuto;
  detail: string;
  manual: FactView | null;
  done: boolean;
  /** Where to go to make progress. */
  href: string | null;
}

export interface CompletenessInputs {
  variances: VarianceItem[];
  dueDiligence: DueDiligenceItem[];
  decisions: DecisionPoint[];
  documents: DocAccount[];
  checks: CheckRun;
}

export function requiredSteps(packet: Packet, index: PacketIndex, ledger: Ledger, inputs: CompletenessInputs): StepStatus[] {
  const docsOfType = (t: string) => packet.documents.filter((d) => d.document_type === t);
  const resolved = resolvedFindingIds(ledger);
  const carryLines = [...(index.lines.get(index.latestVersion)?.values() ?? [])].filter((l) => l.rule === "R-PRIOR-YEAR-CARRY");
  return packet.firm.starter_standards.required_steps.map((label, i) => {
    const target = "step:" + i;
    const manual = ledger.latest(target, "step");
    let auto: StepAuto = null;
    let detail = "";
    let href: string | null = null;
    const L = label.toLowerCase();
    if (/engagement letter/.test(L)) {
      const have = [...docsOfType("engagement_letter"), ...docsOfType("consent_7216")];
      auto = have.length >= 2 ? "done" : "open";
      detail = have.length ? "In file: " + have.map((d) => d.id).join(", ") : "No engagement letter or consent in the file.";
      href = "/documents";
    } else if (/identity/.test(L)) {
      const have = [...docsOfType("identity_document"), ...docsOfType("irs_ip_pin_notice")];
      auto = have.length ? (manual?.body.done ? "done" : "open") : "open";
      detail = have.length ? "Identity documents in file: " + have.map((d) => d.id).join(", ") + ". Confirm you compared them." : "No identity documents in the file.";
      href = "/documents";
    } else if (/prior-year return reviewed/.test(L)) {
      const prior = docsOfType("prior_year_return")[0];
      const touched = prior ? ledger.forTarget(prior.id).length > 0 : false;
      auto = manual?.body.done || touched ? "done" : "open";
      detail = prior ? prior.id + (touched ? " has review records." : " is in the file; record that it was reviewed.") : "No prior-year return in the file.";
      href = prior ? "/documents/" + prior.id : "/documents";
    } else if (/documents accounted/.test(L)) {
      const un = inputs.documents.filter((d) => !d.accounted);
      auto = un.length === 0 ? "done" : "open";
      detail = un.length ? un.length + " document" + (un.length === 1 ? "" : "s") + " reach no line and have no disposition: " + un.map((d) => d.doc.id).join(", ") : "Every document feeds the return, was superseded, or has a disposition.";
      href = "/completeness#documents";
    } else if (/variances explained/.test(L)) {
      const open = inputs.variances.filter((v) => !v.explanation);
      auto = open.length === 0 ? "done" : "open";
      detail = inputs.variances.length ? inputs.variances.length - open.length + " of " + inputs.variances.length + " flagged swings explained." : "No swings over the firm threshold.";
      href = "/judgment#variances";
    } else if (/carryovers/.test(L)) {
      const clean = inputs.checks.findings.every((f) => f.check !== "prior-year-carry");
      const verified = carryLines.filter((l) => ledger.summary(l.key).verifications.length > 0).length;
      auto = !clean ? "blocked" : verified === carryLines.length || manual?.body.done ? "done" : "open";
      detail = (clean ? "Carryover check agrees to the 2024 records. " : "The carryover check reports differences. ") + verified + " of " + carryLines.length + " carryover lines verified.";
      href = "/checks?area=carryovers";
    } else if (/estimated payments/.test(L)) {
      const findings = inputs.checks.findings.filter((f) => (f.check === "federal-estimates" || f.check === "california-estimates") && f.severity === "error");
      const unresolved = findings.filter((f) => !resolved.has(f.id));
      auto = findings.length === 0 ? "done" : unresolved.length ? "blocked" : "done";
      detail = findings.length === 0 ? "Payments agree to the IRS transcript and the FTB account." : unresolved.length ? unresolved.length + " payment finding" + (unresolved.length === 1 ? "" : "s") + " not yet corrected or explained." : "Payment findings corrected by adjustment.";
      href = "/checks?area=payments";
    } else if (/due diligence/.test(L)) {
      const applicable = inputs.dueDiligence.filter((d) => d.applicable);
      const doneCount = applicable.filter((d) => d.recorded).length;
      auto = applicable.length === 0 || doneCount === applicable.length ? "done" : "open";
      detail = doneCount + " of " + applicable.length + " applicable credits documented.";
      href = "/judgment#due-diligence";
    } else if (/diagnostics resolved/.test(L)) {
      const diags = inputs.decisions.filter((d) => d.kind === "diagnostic" || d.target.startsWith("diag:"));
      const openDiags = diags.filter((d) => !d.recorded).length;
      const errors = inputs.checks.findings.filter((f) => f.severity === "error");
      const openErrors = errors.filter((f) => !resolved.has(f.id)).length;
      auto = openDiags === 0 && openErrors === 0 ? "done" : "open";
      detail = diags.length - openDiags + " of " + diags.length + " engine diagnostics addressed; " + (errors.length - openErrors) + " of " + errors.length + " check errors corrected or explained.";
      href = "/checks";
    } else if (/sign-off|client approval/.test(L)) {
      auto = "later";
      detail = "Comes with the review workflow (Phase 6).";
    }
    const done = auto === "done" || (auto !== "blocked" && auto !== "later" && manual?.body.done === true);
    return { index: i, label, target, auto, detail, manual, done, href };
  });
}
