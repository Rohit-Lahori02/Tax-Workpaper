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
  total: 0,
};
