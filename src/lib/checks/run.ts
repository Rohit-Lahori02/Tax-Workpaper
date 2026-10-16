import type { PacketIndex } from "@/lib/packet/index";
import type { Packet } from "@/lib/packet/schema";
import { businessChecks } from "./business";
import { deductionChecks } from "./deductions";
import { documentChecks } from "./documents";
import { investmentChecks } from "./investments";
import { lineChecks } from "./lines";
import { paymentChecks } from "./payments";
import { rentalChecks } from "./rentals";
import { stateChecks } from "./state";
import type { Check, CheckContext, CheckResult, Finding } from "./types";

const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const ALL_CHECKS: Check[] = [
  ...lineChecks,
  ...documentChecks,
  ...paymentChecks,
  ...investmentChecks,
  ...businessChecks,
  ...rentalChecks,
  ...stateChecks,
  ...deductionChecks,
];

export function makeContext(packet: Packet, index: PacketIndex, versionId: string): CheckContext {
  const version = index.versions.get(versionId)!;
  const lines = index.lines.get(versionId)!;
  const rates = version.tax_effect_rates;
  return {
    packet,
    index,
    version,
    lines,
    value: (id) => index.values.get(id),
    num: (id) => {
      const v = index.values.get(id)?.value;
      return typeof v === "number" ? v : null;
    },
    line: (key) => lines.get(key),
    lineNum: (key) => {
      const v = lines.get(key)?.value;
      return typeof v === "number" ? v : null;
    },
    money: (n) => money.format(Math.round(n * 100) / 100),
    effect: (category, delta) => {
      const r = rates[category];
      if (!r) return { federal: 0, california: 0 };
      return { federal: Math.round(r.federal_per_dollar * delta), california: Math.round(r.california_per_dollar * delta) };
    },
  };
}

export interface CheckRun {
  version: string;
  results: CheckResult[];
  findings: Finding[];
  counts: { error: number; warning: number; info: number; checks: number; clean: number };
}

const cache = new Map<string, CheckRun>();

/** Runs every check against one engine version. Pure over the packet, so the result is memoised per process. */
export function runChecks(packet: Packet, index: PacketIndex, versionId = index.latestVersion): CheckRun {
  const cached = cache.get(versionId);
  if (cached) return cached;
  const ctx = makeContext(packet, index, versionId);
  const results: CheckResult[] = ALL_CHECKS.map((c) => {
    let findings: Finding[] = [];
    try {
      findings = c.run(ctx);
    } catch (e) {
      findings = [
        {
          id: c.id + ":crashed",
          check: c.id,
          area: c.area,
          severity: "warning",
          title: "Check could not run",
          detail: e instanceof Error ? e.message : String(e),
          refs: [],
        },
      ];
    }
    return { check: c.id, area: c.area, title: c.title, coverage: c.coverage(ctx), findings };
  });
  const findings = results.flatMap((r) => r.findings);
  const run: CheckRun = {
    version: versionId,
    results,
    findings,
    counts: {
      error: findings.filter((f) => f.severity === "error").length,
      warning: findings.filter((f) => f.severity === "warning").length,
      info: findings.filter((f) => f.severity === "info").length,
      checks: results.length,
      clean: results.filter((r) => r.findings.length === 0).length,
    },
  };
  cache.set(versionId, run);
  return run;
}
