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
  /** Any non-control fact at all, retracted ones excluded. */
  total: number;
}

export const EMPTY_SUMMARY: TargetSummary = {
  verifications: [],
  openNotes: 0,
  blockingOpen: 0,
  openQuestions: 0,
  attachments: 0,
  total: 0,
};
