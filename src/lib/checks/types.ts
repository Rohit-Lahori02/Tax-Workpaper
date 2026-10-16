import type { PacketIndex } from "@/lib/packet/index";
import type { ExtractedValue, Packet, ReturnLine, ReturnVersion } from "@/lib/packet/schema";

export type Severity = "error" | "warning" | "info";

export type Area =
  | "arithmetic"
  | "sources"
  | "documents"
  | "wages"
  | "payments"
  | "investments"
  | "business"
  | "rentals"
  | "state"
  | "carryovers"
  | "foreign"
  | "deductions";

export const AREA_LABELS: Record<Area, string> = {
  arithmetic: "Arithmetic",
  sources: "Lines vs sources",
  documents: "Documents and extraction",
  wages: "Wages and withholding",
  payments: "Payments vs agency records",
  investments: "Investments and digital assets",
  business: "Business (Schedule C)",
  rentals: "Rentals and depreciation",
  state: "California split",
  carryovers: "Carryovers and basis",
  foreign: "Foreign items",
  deductions: "Deductions and credits",
};

/** Estimated tax effect of a difference, from the version's per-dollar rates. */
export interface TaxEffect {
  federal: number;
  california: number;
}

export interface Finding {
  /** Stable across runs so people can attach facts to it: check:<id> */
  id: string;
  check: string;
  area: Area;
  severity: Severity;
  title: string;
  detail: string;
  refs: string[];
  expected?: string;
  actual?: string;
  difference?: number;
  effect?: TaxEffect | null;
}

export interface CheckResult {
  check: string;
  area: Area;
  title: string;
  /** What was examined, in plain words, so a clean result still proves coverage. */
  coverage: string;
  findings: Finding[];
}

export interface CheckContext {
  packet: Packet;
  index: PacketIndex;
  version: ReturnVersion;
  lines: Map<string, ReturnLine>;
  value(id: string): ExtractedValue | undefined;
  num(id: string): number | null;
  line(key: string): ReturnLine | undefined;
  lineNum(key: string): number | null;
  /** Rounds to cents and formats with thousands separators. */
  money(n: number): string;
  effect(category: string, delta: number): TaxEffect;
}

export interface Check {
  id: string;
  area: Area;
  title: string;
  coverage: (ctx: CheckContext) => string;
  run: (ctx: CheckContext) => Finding[];
}

export function findingTarget(f: Finding): string {
  return "check:" + f.id;
}
