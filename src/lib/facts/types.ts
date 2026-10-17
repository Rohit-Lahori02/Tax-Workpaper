import { z } from "zod";
import type { Role } from "@/lib/roles";

export const FACT_KINDS = [
  "verification",
  "note",
  "question",
  "answer",
  "attachment",
  "retract",
  "resolve",
  "sensitive_view",
  "adjustment",
  "seen",
  "judgment",
  "disposition",
  "step",
  "signoff",
  "assignment",
  "approval_request",
  "approval",
] as const;
export type FactKind = (typeof FACT_KINDS)[number];

export const KIND_LABELS: Record<FactKind, string> = {
  verification: "Verified",
  note: "Note",
  question: "Question",
  answer: "Answer",
  attachment: "Attachment",
  retract: "Retracted",
  resolve: "Resolved",
  sensitive_view: "Viewed sensitive data",
  adjustment: "Adjusted",
  seen: "Caught up",
  judgment: "Judgment recorded",
  disposition: "Document disposition",
  step: "Required step",
  signoff: "Signed off",
  assignment: "Assigned",
  approval_request: "Sent to client for approval",
  approval: "Client approved and signed",
};

export const JUDGMENT_TYPES = [
  "variance",
  "judgment_call",
  "election",
  "due_diligence",
  "penalty",
  "outside_filing",
  "area_review",
  "diagnostic",
] as const;
export type JudgmentType = (typeof JUDGMENT_TYPES)[number];

export const JUDGMENT_LABELS: Record<JudgmentType, string> = {
  variance: "Variance explained",
  judgment_call: "Judgment call",
  election: "Election",
  due_diligence: "Due diligence",
  penalty: "Penalty decision",
  outside_filing: "Outside filing",
  area_review: "Area considered",
  diagnostic: "Diagnostic resolved",
};

/** Document dispositions for files that reach no line of the return. */
export const DISPOSITIONS = ["duplicate", "not_relevant", "reference_only", "used_elsewhere", "pending"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];
export const DISPOSITION_LABELS: Record<Disposition, string> = {
  duplicate: "Duplicate of another document",
  not_relevant: "Not relevant to this return",
  reference_only: "Reference only (identity, engagement, agency record)",
  used_elsewhere: "Used outside the computed return",
  pending: "Still to be dealt with",
};

const text = z.string().trim().min(1, "Say something").max(4000, "Keep it under 4,000 characters");

export const VerificationBody = z.object({
  type: z.string().min(1),
  note: z.string().trim().max(4000).optional(),
});
export const NoteBody = z.object({
  text,
  blocking: z.boolean(),
});
export const QuestionBody = z.object({
  text,
  /** "client" or a staff id */
  to: z.string().min(1),
});
export const AnswerBody = z.object({
  questionId: z.string().uuid(),
  text,
  /** True when staff recorded the client's answer (call, message) rather than the client typing it. */
  onBehalf: z.boolean().optional(),
});
export const AttachmentBody = z.object({
  blobId: z.string().uuid(),
  name: z.string().min(1),
  mime: z.string(),
  size: z.number().int().nonnegative(),
  note: z.string().trim().max(4000).optional(),
});
export const RetractBody = z.object({
  factId: z.string().uuid(),
  reason: z.string().trim().max(4000).optional(),
});
export const ResolveBody = z.object({
  factId: z.string().uuid(),
  text: z.string().trim().max(4000).optional(),
});
export const SensitiveViewBody = z.object({
  fields: z.array(z.string()),
});
export const AdjustmentBody = z.object({
  engineValue: z.number(),
  newValue: z.number(),
  delta: z.number(),
  reason: text,
  authority: z.string().trim().max(400).optional(),
  category: z.string().min(1),
  effect: z.object({ federal: z.number(), california: z.number(), affectsTax: z.boolean() }),
  requiresPartner: z.boolean(),
  basedOn: z.string().min(1),
  fromFinding: z.string().optional(),
  whatIf: z.string().optional(),
});
export const SeenBody = z.object({ seq: z.number().int().nonnegative() });
export type AdjustmentBody = z.infer<typeof AdjustmentBody>;

export const JudgmentBody = z.object({
  type: z.enum(JUDGMENT_TYPES),
  text,
  /** Required for judgment calls and elections by firm rule. */
  authority: z.string().trim().max(400).optional(),
  /** The option chosen, when the decision has named options. */
  choice: z.string().trim().max(200).optional(),
  /** Checklist answers for due diligence. */
  answers: z.array(z.boolean()).optional(),
  /** Status word for outside filings: informed, referred, filed, not_required. */
  status: z.string().trim().max(60).optional(),
});
export type JudgmentBody = z.infer<typeof JudgmentBody>;

export const DispositionBody = z.object({
  disposition: z.enum(DISPOSITIONS),
  text: z.string().trim().max(4000).optional(),
});
export type DispositionBody = z.infer<typeof DispositionBody>;

export const StepBody = z.object({
  done: z.boolean(),
  text: z.string().trim().max(4000).optional(),
});
export type StepBody = z.infer<typeof StepBody>;

export const SignoffBody = z.object({
  /** preparer | reviewer | partner, from the firm's review levels. */
  level: z.string().min(1),
  /** area:<id> | return | fact:<adjustment id> */
  scope: z.string().min(1),
  /** SHA-256 of what was signed; the sign-off reopens when it no longer matches. */
  hash: z.string().length(64),
  /** Snapshot summary for showing what changed later. */
  snapshot: z.object({
    facts: z.number().int(),
    lines: z.record(z.string(), z.union([z.number(), z.string()])),
    adjustments: z.number().int(),
  }),
  text: z.string().trim().max(4000).optional(),
});
export type SignoffBody = z.infer<typeof SignoffBody>;

export const AssignmentBody = z.object({
  /** preparer | reviewer | partner */
  role: z.string().min(1),
  assigneeId: z.string().min(1),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  text: z.string().trim().max(1000).optional(),
});
export type AssignmentBody = z.infer<typeof AssignmentBody>;

export const ApprovalRequestBody = z.object({
  hash: z.string().length(64),
  message: z.string().trim().max(4000).optional(),
});

export const ApprovalBody = z.object({
  hash: z.string().length(64),
  signerName: z.string().trim().min(2).max(200),
  /** Last two digits only; the full self-selected PIN is never stored here. */
  pinHint: z.string().length(2),
  consent: z.literal(true),
  federalBalance: z.number(),
  californiaBalance: z.number(),
  version: z.string(),
  adjustments: z.number().int(),
});
export type ApprovalBody = z.infer<typeof ApprovalBody>;

export type VerificationBody = z.infer<typeof VerificationBody>;
export type NoteBody = z.infer<typeof NoteBody>;
export type QuestionBody = z.infer<typeof QuestionBody>;
export type AnswerBody = z.infer<typeof AnswerBody>;
export type AttachmentBody = z.infer<typeof AttachmentBody>;
export type RetractBody = z.infer<typeof RetractBody>;
export type ResolveBody = z.infer<typeof ResolveBody>;
export type SensitiveViewBody = z.infer<typeof SensitiveViewBody>;

/** A ledger row as the UI sees it: plain data, safe to hand to client components. */
export interface FactView {
  id: string;
  seq: number;
  kind: FactKind | string;
  actorId: string;
  actorName: string;
  actorRole: Role | "unknown";
  /** ISO timestamp */
  at: string;
  target: string;
  body: Record<string, unknown>;
  batchId: string | null;
  supersedes: string | null;
  retracted: boolean;
  resolved: boolean;
  /** For questions: the answers given, oldest first. */
  answers: FactView[];
}

export interface TargetSummary {
  verifications: string[];
  openNotes: number;
  blockingOpen: number;
  openQuestions: number;
  attachments: number;
  adjustments: number;
  judgments: number;
  /** Any non-control fact at all, retracted ones excluded. */
  total: number;
}

export const EMPTY_SUMMARY: TargetSummary = {
  verifications: [],
  openNotes: 0,
  blockingOpen: 0,
  openQuestions: 0,
  attachments: 0,
  adjustments: 0,
  judgments: 0,
  total: 0,
};
