/** Friendly names and display order for the form codes used in line keys. */
const FORM_LABELS: Record<string, string> = {
  F1040: "Form 1040",
  Sch1: "Schedule 1 · Additional income and adjustments",
  Sch2: "Schedule 2 · Additional taxes",
  Sch3: "Schedule 3 · Credits and payments",
  SchA: "Schedule A · Itemized deductions",
  SchB: "Schedule B · Interest and dividends",
  SchC: "Schedule C · Business",
  SchD: "Schedule D · Capital gains and losses",
  SchE: "Schedule E · Rentals and pass-throughs",
  SchSE: "Schedule SE · Self-employment tax",
  F8949: "Form 8949 · Sales of capital assets",
  F4797: "Form 4797 · Sales of business property",
  "F4562-C": "Form 4562 · Depreciation (Schedule C)",
  "F4562-E": "Form 4562 · Depreciation (rentals)",
  F8582: "Form 8582 · Passive activity losses",
  F6251: "Form 6251 · Alternative minimum tax",
  F8959: "Form 8959 · Additional Medicare tax",
  F8960: "Form 8960 · Net investment income tax",
  F8995: "Form 8995 · Qualified business income",
  F8995A: "Form 8995-A · Qualified business income",
  F8812: "Schedule 8812 · Child tax credit",
  F8863: "Form 8863 · Education credits",
  F2441: "Form 2441 · Dependent care",
  F8889: "Form 8889 · Health savings accounts",
  F8606: "Form 8606 · Nondeductible IRAs",
  F8283: "Form 8283 · Noncash charitable contributions",
  F7203: "Form 7203 · S corporation basis",
  F8938: "Form 8938 · Foreign financial assets",
  F2210: "Form 2210 · Underpayment penalty",
  F8867: "Form 8867 · Due diligence",
  F540NR: "Form 540NR · California nonresident return",
  SchCA540NR: "Schedule CA (540NR) · California adjustments",
  ScheduleS: "Schedule S · Other state tax credit",
  FTB3885A: "FTB 3885A · Depreciation",
  FTB5805: "FTB 5805 · Underpayment penalty",
  CA540: "Form 540 · California resident return (2024)",
};

const FORM_ORDER = [
  "F1040",
  "Sch1",
  "Sch2",
  "Sch3",
  "SchA",
  "SchB",
  "SchC",
  "SchSE",
  "SchD",
  "F8949",
  "F4797",
  "SchE",
  "F8582",
  "F4562-C",
  "F4562-E",
  "F7203",
  "F8606",
  "F8889",
  "F2441",
  "F8812",
  "F8863",
  "F8283",
  "F8995",
  "F8995A",
  "F6251",
  "F8959",
  "F8960",
  "F2210",
  "F8938",
  "F8867",
  "F540NR",
  "SchCA540NR",
  "ScheduleS",
  "FTB3885A",
  "FTB5805",
  "CA540",
];

export function formLabel(code: string): string {
  return FORM_LABELS[code] ?? code;
}

/** Short name without the description, for breadcrumbs and chips. */
export function formShort(code: string): string {
  return formLabel(code).split(" · ")[0];
}

export function formRank(code: string): number {
  const i = FORM_ORDER.indexOf(code);
  return i === -1 ? FORM_ORDER.length : i;
}

export function sortForms<T extends { form: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => formRank(a.form) - formRank(b.form) || a.form.localeCompare(b.form));
}
