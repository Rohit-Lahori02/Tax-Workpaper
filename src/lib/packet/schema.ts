import { z } from "zod";

/**
 * Typed view of the Miraflores packet. Fields the workpaper relies on are
 * validated strictly; everything else is kept as delivered (loose objects) so
 * a newer packet with extra fields still loads.
 */

export const PersonSchema = z.looseObject({
  id: z.string(),
  role: z.enum(["taxpayer", "spouse", "dependent"]),
  name: z.string(),
  ssn: z.string().nullable().optional(),
  dob: z.string(),
  relationship: z.string().optional(),
  months_lived_with_you: z.number().optional(),
  full_time_student: z.boolean().optional(),
  ip_pin: z.string().nullable().optional(),
  occupation: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  note: z.string().optional(),
  own_income: z.string().optional(),
});
export type Person = z.infer<typeof PersonSchema>;

export const HouseholdSchema = z.looseObject({
  filing_status: z.string(),
  tax_year: z.number().int(),
  entered_by: z.string(),
  people: z.array(PersonSchema),
  addresses: z.array(
    z.looseObject({ from: z.string(), to: z.string().nullable(), address: z.string(), type: z.string() }),
  ),
  residency: z.array(
    z.looseObject({ state: z.string(), from: z.string(), to: z.string(), status: z.string() }),
  ),
  bank_account_for_refund_or_payment: z.looseObject({
    routing: z.string(),
    account: z.string(),
    type: z.string(),
    bank: z.string(),
  }),
  prior_year_agi_for_esignature: z.number(),
  related_returns: z.array(
    z.looseObject({
      who: z.string(),
      return: z.string(),
      prepared_by: z.string(),
      /** false, or a note saying which parts (for example K-1s) are in the packet. */
      in_this_packet: z.union([z.boolean(), z.string()]),
    }),
  ),
});
export type Household = z.infer<typeof HouseholdSchema>;

export const PageSchema = z.object({ page: z.number().int(), printed_content: z.string() });
export type DocumentPage = z.infer<typeof PageSchema>;

export const ExtractionStatusSchema = z.enum(["extracted", "partial", "not_extracted"]);
export type ExtractionStatus = z.infer<typeof ExtractionStatusSchema>;

export const DocumentSchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  document_type: z.string(),
  issuer: z.string(),
  belongs_to: z.string(),
  tax_year: z.number().int(),
  received_at: z.string(),
  uploaded_by: z.enum(["client", "firm"]),
  file_name: z.string(),
  page_count: z.number().int(),
  pages: z.array(PageSchema),
  marked_corrected: z.boolean().optional(),
  extraction: z.object({
    status: ExtractionStatusSchema,
    values: z.number().int(),
    reason: z.string().nullable().optional(),
  }),
});
export type PacketDocument = z.infer<typeof DocumentSchema>;

export const ValueTypeSchema = z.enum([
  "money",
  "date",
  "text",
  "integer",
  "quantity",
  "percent",
  "boolean",
  "code",
  "ssn",
  "ein",
  "account_number",
]);
export type ValueType = z.infer<typeof ValueTypeSchema>;

export const ExtractedValueSchema = z.object({
  id: z.string(),
  document_id: z.string(),
  page: z.number().int(),
  field: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  value_type: ValueTypeSchema,
  text_as_read: z.string(),
  position: z.object({ x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() }),
  confidence: z.number().min(0).max(1),
});
export type ExtractedValue = z.infer<typeof ExtractedValueSchema>;

export const QuestionnaireItemSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  answered_by: z.string(),
  answered_at: z.string(),
});
export type QuestionnaireItem = z.infer<typeof QuestionnaireItemSchema>;

export const ClientMessageSchema = z.object({
  id: z.string(),
  sent_at: z.string(),
  from: z.string(),
  to: z.string(),
  text: z.string(),
});
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const CallNoteSchema = z.object({
  id: z.string(),
  date: z.string(),
  participants: z.array(z.string()),
  notes: z.array(z.string()),
});
export type CallNote = z.infer<typeof CallNoteSchema>;

export const StaffRoleSchema = z.enum([
  "preparer",
  "reviewer",
  "partner",
  "firm_administrator",
  "quality_reviewer",
]);
export type StaffRole = z.infer<typeof StaffRoleSchema>;

export const StaffSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  role: StaffRoleSchema,
  credential: z.string().nullable(),
  sensitive_data_clearance: z.boolean(),
  active_from: z.string(),
  note: z.string().optional(),
});
export type Staff = z.infer<typeof StaffSchema>;

export const FirmSchema = z.looseObject({
  name: z.string(),
  staff: z.array(StaffSchema),
  firm_identity: z.record(z.string(), z.unknown()),
  client_users: z.array(z.object({ id: z.string(), name: z.string(), role: z.string() })),
  assignment_at_start: z.object({ preparer: z.string(), reviewer: z.string(), partner: z.string() }),
  deadlines: z.array(z.object({ what: z.string(), date: z.string() })),
  budget_hours: z.record(z.string(), z.number()),
  starter_standards: z.looseObject({
    note: z.string().optional(),
    verification_types: z.array(z.string()),
    variance_review: z.object({
      compare_to: z.string(),
      flag_if_change_over_percent: z.number(),
      and_over_amount: z.number(),
    }),
    review_levels: z.array(z.string()),
    rules: z.array(z.string()),
    required_steps: z.array(z.string()),
  }),
});
export type Firm = z.infer<typeof FirmSchema>;

export const LineValueSchema = z.union([z.number(), z.string()]);
export type LineValue = z.infer<typeof LineValueSchema>;

export const ReturnLineSchema = z.object({
  key: z.string(),
  jurisdiction: z.enum(["federal", "california"]),
  form: z.string(),
  line: z.string(),
  label: z.string(),
  value: LineValueSchema,
  rule: z.string(),
  inputs: z.array(z.string()),
  sources: z.array(z.string()),
  note: z.string().optional(),
});
export type ReturnLine = z.infer<typeof ReturnLineSchema>;

export const DiagnosticSchema = z.object({
  code: z.string(),
  severity: z.enum(["info", "warning"]),
  message: z.string(),
  refs: z.array(z.string()),
});
export type Diagnostic = z.infer<typeof DiagnosticSchema>;

export const LineChangeSchema = z.object({
  key: z.string(),
  change: z.enum(["added", "changed", "removed"]),
  old: z.unknown().optional(),
  new: z.unknown().optional(),
});
export type LineChange = z.infer<typeof LineChangeSchema>;

export const VersionAssetSchema = z.looseObject({
  asset_id: z.string(),
  description: z.string(),
  activity: z.string(),
  cost: z.number(),
  placed_in_service: z.string(),
  method: z.string(),
  life_years: z.number(),
  federal: z.record(z.string(), z.unknown()),
  california: z.record(z.string(), z.unknown()),
  amt: z.record(z.string(), z.unknown()).optional(),
  disposed: z.unknown().nullable().optional(),
  sources: z.array(z.string()),
});
export type VersionAsset = z.infer<typeof VersionAssetSchema>;

export const TaxEffectRateSchema = z.object({
  federal_per_dollar: z.number(),
  california_per_dollar: z.number(),
});
export type TaxEffectRate = z.infer<typeof TaxEffectRateSchema>;

export const ReturnVersionSchema = z.looseObject({
  version: z.string(),
  computed_at: z.string(),
  trigger: z.string(),
  documents_used: z.array(z.string()),
  documents_superseded: z.array(z.string()),
  summary: z.object({
    federal: z.record(z.string(), z.number()),
    california: z.record(z.string(), z.number()),
  }),
  tax_effect_rates: z.record(z.string(), TaxEffectRateSchema),
  carryovers_out: z.object({
    federal: z.record(z.string(), z.unknown()),
    california: z.record(z.string(), z.unknown()),
  }),
  assets: z.array(VersionAssetSchema),
  diagnostics: z.array(DiagnosticSchema),
  changes_from_previous: z.array(LineChangeSchema),
  lines: z.array(ReturnLineSchema),
});
export type ReturnVersion = z.infer<typeof ReturnVersionSchema>;

export const TimelineEventSchema = z.object({
  id: z.string(),
  at: z.string(),
  event: z.string(),
  actor: z.string().nullable(),
  detail: z.string().nullable(),
  refs: z.array(z.string()),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const WhatIfAlternativeSchema = z.looseObject({
  id: z.string(),
  description: z.string(),
  base_version: z.string(),
  choices: z.record(z.string(), z.unknown()),
  federal: z.record(z.string(), z.unknown()),
  california: z.record(z.string(), z.unknown()),
  changed_lines: z.array(LineChangeSchema),
});
export type WhatIfAlternative = z.infer<typeof WhatIfAlternativeSchema>;

export const PriorAssetRecordSchema = z.looseObject({
  asset_id: z.string(),
  description: z.string(),
  activity: z.string(),
  cost: z.number(),
  placed_in_service: z.string(),
  method: z.string(),
  life_years: z.number(),
  disposed: z.unknown().nullable(),
  land_value: z.number().nullable().optional(),
  federal: z.record(z.string(), z.number()),
  california: z.record(z.string(), z.number()),
  amt_difference: z.record(z.string(), z.unknown()),
  sources: z.array(z.string()),
});
export type PriorAssetRecord = z.infer<typeof PriorAssetRecordSchema>;

export const PriorYearsSchema = z.looseObject({
  return_2024: z.looseObject({
    prepared_by: z.string(),
    filed: z.string(),
    residency: z.string(),
    dependents: z.array(z.unknown()),
    lines: z.record(z.string(), LineValueSchema),
    line_labels: z.record(z.string(), z.string()),
    line_sources: z.record(z.string(), z.string()),
    notes: z.record(z.string(), z.string()),
  }),
  prior_preparer_workpaper: z.looseObject({
    source_document: z.string(),
    summary_memo: z.string(),
    notes: z.array(z.string()),
    open_items_left_by_prior_preparer: z.array(z.string()),
    depreciation_schedule: z.string(),
  }),
  asset_records: z.array(PriorAssetRecordSchema),
  basis_records: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
  carryovers_into_2025: z.record(z.string(), z.unknown()),
});
export type PriorYears = z.infer<typeof PriorYearsSchema>;

export const NoticeSchema = z.looseObject({
  id: z.string(),
  agency: z.string(),
  type: z.string(),
  tax_year: z.number().int(),
  dated: z.string(),
  summary: z.string().optional(),
  items_under_examination: z.array(z.string()).optional(),
  status: z.string().optional(),
  response_due: z.string().optional(),
  document: z.string().optional(),
});
export type Notice = z.infer<typeof NoticeSchema>;

export const TaxAgencyRecordsSchema = z.looseObject({
  irs_account_transcript_2025: z.array(
    z.object({
      as_of: z.string(),
      transactions: z.array(
        z.object({
          date: z.string(),
          code: z.string(),
          description: z.string(),
          /** Post-filing rows are scripted and carry a description instead of a number. */
          amount: z.union([z.number(), z.string()]),
        }),
      ),
    }),
  ),
  ftb_account: z.record(z.string(), z.unknown()),
  notices: z.array(NoticeSchema),
  efile: z.array(
    z.looseObject({
      date: z.string(),
      jurisdiction: z.string(),
      submission_id: z.string(),
      status: z.string(),
      errors: z.array(z.object({ code: z.string(), message: z.string() })).optional(),
    }),
  ),
});
export type TaxAgencyRecords = z.infer<typeof TaxAgencyRecordsSchema>;

export const PacketSchema = z.looseObject({
  packet: z.object({
    name: z.string(),
    version: z.string(),
    generated: z.string(),
    client_id: z.string(),
  }),
  readme: z.record(z.string(), z.unknown()),
  household: HouseholdSchema,
  documents: z.array(DocumentSchema),
  extracted_values: z.array(ExtractedValueSchema),
  client: z.object({
    questionnaire: z.array(QuestionnaireItemSchema),
    messages: z.array(ClientMessageSchema),
    call_notes: z.array(CallNoteSchema),
  }),
  firm: FirmSchema,
  prior_years: PriorYearsSchema,
  tax_agency_records: TaxAgencyRecordsSchema,
  timeline: z.array(TimelineEventSchema),
  engine_reference: z.object({
    parameters: z.record(z.string(), z.unknown()),
    rules: z.record(z.string(), z.string()),
  }),
  return_versions: z.array(ReturnVersionSchema).min(1),
  what_if: z.looseObject({
    alternatives: z.array(WhatIfAlternativeSchema),
    extension: z.record(z.string(), z.unknown()),
  }),
  planning_reference_2026: z.record(z.string(), z.unknown()),
  post_filing_rates: z.record(z.string(), z.unknown()),
  fx_rates: z.record(z.string(), z.unknown()),
});
export type Packet = z.infer<typeof PacketSchema>;
