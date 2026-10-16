/**
 * Prints every workpaper check finding for the delivered packet.
 * Usage: pnpm exec tsx scripts/checks-report.ts [version]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { runChecks } from "../src/lib/checks/run";
import { buildIndex } from "../src/lib/packet/index";
import { PacketSchema } from "../src/lib/packet/schema";

const raw: unknown = JSON.parse(readFileSync(path.join(process.cwd(), "data", "packet.json"), "utf8"));
const packet = PacketSchema.parse(raw);
const index = buildIndex(packet);
const run = runChecks(packet, index, process.argv[2] ?? index.latestVersion);

console.log(`Version ${run.version}: ${run.counts.checks} checks, ${run.counts.clean} clean, ${run.counts.error} errors, ${run.counts.warning} warnings, ${run.counts.info} info\n`);
for (const r of run.results) {
  console.log(`## ${r.check} (${r.area}) — ${r.findings.length ? r.findings.length + " finding(s)" : "clean"}`);
  console.log(`   ${r.coverage}`);
  for (const f of r.findings) {
    const effect = f.effect ? ` | effect fed ${f.effect.federal} / CA ${f.effect.california}` : "";
    console.log(`   [${f.severity}] ${f.title}${f.difference !== undefined ? " | diff " + f.difference : ""}${effect}`);
  }
}
