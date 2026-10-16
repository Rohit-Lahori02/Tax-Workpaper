import type { Check, Finding } from "./types";

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/** A donated vehicle sold by the charity is deductible at the sale proceeds on Form 1098-C, not the donor's estimate. */
const vehicleGift: Check = {
  id: "vehicle-gift",
  area: "deductions",
  title: "Donated vehicle valued at the charity's sale proceeds",
  coverage: (ctx) => ctx.packet.documents.filter((d) => d.document_type === "1098-C").length + " Form(s) 1098-C were compared with the noncash gift lines that cite them or describe the same vehicle.",
  run: (ctx) => {
    const out: Finding[] = [];
    for (const d of ctx.packet.documents) {
      if (d.document_type !== "1098-C") continue;
      const vals = ctx.index.valuesByDocument.get(d.id) ?? [];
      const proceeds = vals.find((v) => /4c|proceeds/i.test(v.field + " " + v.label) && isNum(v.value));
      if (!proceeds) continue;
      const line = [...ctx.lines.values()].find(
        (l) => l.rule === "R-NONCASH-GIFT" && isNum(l.value) && (l.sources.some((s) => vals.some((v) => v.id === s)) || /vehicle|auto|subaru|car\b/i.test(l.key + " " + l.label)),
      );
      if (!line || !isNum(line.value)) continue;
      if (line.value > (proceeds.value as number) + 1) {
        const diff = (proceeds.value as number) - line.value;
        const qa = line.sources.find((s) => s.startsWith("qa-"));
        out.push({
          id: "vehicle-gift:" + line.key,
          check: "vehicle-gift",
          area: "deductions",
          severity: "error",
          title: "Vehicle gift claimed at " + ctx.money(line.value) + "; the charity sold it for " + ctx.money(proceeds.value as number),
          detail:
            "Form 1098-C (" +
            d.id +
            ") reports gross proceeds of " +
            ctx.money(proceeds.value as number) +
            " from the sale. When the charity sells the vehicle, the deduction is limited to those proceeds" +
            (qa ? "; the " + ctx.money(line.value) + " comes from the client's estimate in the questionnaire" : "") +
            ". The itemized deduction is overstated by " +
            ctx.money(-diff) +
            ".",
          refs: [line.key, d.id, proceeds.id, ...line.sources],
          expected: ctx.money(proceeds.value as number),
          actual: ctx.money(line.value),
          difference: diff,
          effect: ctx.effect("itemized", diff),
        });
      }
    }
    return out;
  },
};

const saltCap: Check = {
  id: "salt-cap",
  area: "deductions",
  title: "State and local tax deduction capped as the engine states",
  coverage: () => "Schedule A line 5e was recomputed from line 5d, the cap, the phase-down start and rate, and the floor in engine parameters.",
  run: (ctx) => {
    const out: Finding[] = [];
    const p = ctx.packet.engine_reference.parameters as Record<string, unknown>;
    const total = ctx.lineNum("SchA.5d");
    const limited = ctx.lineNum("SchA.5e");
    const agi = ctx.lineNum("F1040.11");
    if (total === null || limited === null || agi === null) return out;
    const cap = p.salt_cap;
    const start = p.salt_cap_phase_start;
    const rate = p.salt_cap_phase_rate;
    const floor = p.salt_cap_floor;
    if (!isNum(cap) || !isNum(start) || !isNum(rate) || !isNum(floor)) return out;
    const effectiveCap = Math.max(floor, cap - Math.max(0, agi - start) * rate);
    const expected = Math.min(total, effectiveCap);
    if (Math.abs(expected - limited) > 1) {
      out.push({
        id: "salt-cap:SchA.5e",
        check: "salt-cap",
        area: "deductions",
        severity: "error",
        title: "SALT deduction " + ctx.money(limited) + " vs computed cap " + ctx.money(expected),
        detail: "Total taxes " + ctx.money(total) + ", cap " + ctx.money(effectiveCap) + " at AGI " + ctx.money(agi) + ".",
        refs: ["SchA.5e", "SchA.5d", "F1040.11", "ref:param.salt_cap"],
        expected: ctx.money(expected),
        actual: ctx.money(limited),
      });
    }
    return out;
  },
};

export const deductionChecks: Check[] = [vehicleGift, saltCap];
