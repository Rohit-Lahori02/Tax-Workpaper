import type { ExtractedValue } from "@/lib/packet/schema";
import type { Check, CheckContext, Finding } from "./types";

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function docsOfType(ctx: CheckContext, type: string) {
  return ctx.packet.documents.filter((d) => d.document_type === type);
}

function fieldValue(ctx: CheckContext, docId: string, field: string): ExtractedValue | undefined {
  return (ctx.index.valuesByDocument.get(docId) ?? []).find((v) => v.field === field);
}

/** Third-party information returns versus gross receipts, including a payment-card amount that is already inside a payer's total. */
const grossReceipts: Check = {
  id: "gross-receipts",
  area: "business",
  title: "Gross receipts versus Forms 1099-NEC, 1099-K and the books",
  coverage: (ctx) => docsOfType(ctx, "1099-NEC").length + " Forms 1099-NEC and " + docsOfType(ctx, "1099-K").length + " Form 1099-K were compared with Schedule C line 1 and the books' transaction detail.",
  run: (ctx) => {
    const out: Finding[] = [];
    const gross = ctx.line("SchC.1");
    if (!gross || !isNum(gross.value)) return out;
    const necs = docsOfType(ctx, "1099-NEC").map((d) => ({ doc: d, v: fieldValue(ctx, d.id, "box1") }));
    const necTotal = necs.reduce((a, n) => a + (isNum(n.v?.value) ? (n.v!.value as number) : 0), 0);
    const ks = docsOfType(ctx, "1099-K").map((d) => ({ doc: d, v: fieldValue(ctx, d.id, "box1a") }));
    const kTotal = ks.reduce((a, k) => a + (isNum(k.v?.value) ? (k.v!.value as number) : 0), 0);
    const detail = docsOfType(ctx, "books_transaction_detail")[0];
    const books = docsOfType(ctx, "books_profit_loss")[0];
    const booksIncome = books ? fieldValue(ctx, books.id, "total_income") : undefined;

    if (necTotal + kTotal > gross.value + 1) {
      out.push({
        id: "gross-receipts:under",
        check: "gross-receipts",
        area: "business",
        severity: "error",
        title: "Third parties reported " + ctx.money(necTotal + kTotal) + " but gross receipts are " + ctx.money(gross.value),
        detail: "Forms 1099-NEC total " + ctx.money(necTotal) + " and Form 1099-K " + ctx.money(kTotal) + ". The IRS matches these against Schedule C line 1.",
        refs: ["SchC.1", ...necs.map((n) => n.doc.id), ...ks.map((k) => k.doc.id)],
      });
    }

    // A 1099-K amount that equals a payer's card-paid portion in the transaction detail is already inside that payer's 1099-NEC and the books.
    if (detail) {
      const dv = ctx.index.valuesByDocument.get(detail.id) ?? [];
      for (const k of ks) {
        if (!isNum(k.v?.value)) continue;
        const match = dv.find((v) => isNum(v.value) && v.value === k.v!.value && /paywell|card|processor|_k$/i.test(v.field));
        if (!match) continue;
        const payerField = match.field.replace(/_[a-z]+$/, "_total");
        const payerTotal = dv.find((v) => v.field === payerField);
        const nec = necs.find((n) => isNum(n.v?.value) && payerTotal && n.v!.value === payerTotal.value);
        if (gross.sources.includes(k.v!.id)) {
          const diff = -(k.v!.value as number);
          out.push({
            id: "gross-receipts:k-double-count",
            check: "gross-receipts",
            area: "business",
            severity: "error",
            title: "Form 1099-K " + ctx.money(k.v!.value as number) + " added to gross receipts is already inside a payer's total",
            detail:
              "The books' transaction detail shows " +
              ctx.money(match.value as number) +
              " paid through the card processor as part of " +
              (payerTotal ? ctx.money(payerTotal.value as number) + " from the same payer" : "a payer's total") +
              (nec ? ", which matches the 1099-NEC from " + nec.doc.issuer + " (" + nec.doc.id + ")" : "") +
              ". The books' income of " +
              (booksIncome && isNum(booksIncome.value) ? ctx.money(booksIncome.value) : "the P&L") +
              " already includes it, so the engine's rule (add 1099-K amounts it could not match to a deposit) counted it twice.",
            refs: ["SchC.1", k.v!.id, match.id, ...(payerTotal ? [payerTotal.id] : []), ...(nec ? [nec.doc.id] : []), detail.id],
            difference: diff,
            effect: ctx.effect("schc_profit", diff),
          });
        }
      }
      const unreported = dv.find((v) => /unreported/i.test(v.field) && isNum(v.value));
      if (unreported) {
        out.push({
          id: "gross-receipts:unreported",
          check: "gross-receipts",
          area: "business",
          severity: "warning",
          title: "Transaction detail shows " + ctx.money(unreported.value as number) + " of receipts outside the books' income",
          detail: "The books' transaction detail flags " + ctx.money(unreported.value as number) + " (" + unreported.label + "). Confirm with the client whether these belong in gross receipts.",
          refs: ["SchC.1", unreported.id, detail.id],
          effect: ctx.effect("schc_profit", unreported.value as number),
        });
      }
    }
    return out;
  },
};

/** Expenses the client said are partly personal, taken from the call notes and the books' detail. */
const businessUse: Check = {
  id: "business-use",
  area: "business",
  title: "Mixed-use expenses limited to the business share the client stated",
  coverage: (ctx) => ctx.packet.client.call_notes.length + " client call record(s) were scanned for stated business-use percentages and personal items, and compared with the Schedule C lines built from the books.",
  run: (ctx) => {
    const out: Finding[] = [];
    const notes = ctx.packet.client.call_notes.flatMap((c) => c.notes.map((n) => ({ id: c.id, text: n })));
    const books = ctx.packet.documents.find((d) => d.document_type === "books_profit_loss");
    if (!books) return out;
    const bookValues = ctx.index.valuesByDocument.get(books.id) ?? [];
    const lineFor = (ev: ExtractedValue) =>
      [...ctx.lines.values()].find((l) => l.form === "SchC" && l.sources.includes(ev.id) && isNum(l.value));

    const percentRules: { pattern: RegExp; fields: RegExp }[] = [
      { pattern: /(mobile|phone|cell)/i, fields: /telephone|phone|mobile/i },
      { pattern: /internet/i, fields: /internet/i },
    ];
    for (const rule of percentRules) {
      const note = notes.find((n) => rule.pattern.test(n.text) && /(\d{1,3})\s*%/.test(n.text));
      if (!note) continue;
      const pct = Number(/(\d{1,3})\s*%/.exec(note.text)![1]) / 100;
      const ev = bookValues.find((v) => rule.fields.test(v.field) || rule.fields.test(v.label));
      if (!ev || !isNum(ev.value)) continue;
      const line = lineFor(ev);
      if (!line) continue;
      const allowed = Math.round(ev.value * pct);
      const excess = ev.value - allowed;
      // The line may bundle several book accounts; it is overstated if it includes the full book amount.
      const otherSources = line.sources.filter((s) => s !== ev.id).map((s) => ctx.num(s)).filter(isNum);
      const includedInFull = Math.abs(otherSources.reduce((a, b) => a + b, 0) + ev.value - (line.value as number)) <= 1;
      if (!includedInFull || excess <= 0) continue;
      out.push({
        id: "business-use:" + line.key + ":" + ev.field,
        check: "business-use",
        area: "business",
        severity: "error",
        title: line.key + " deducts all of " + ev.label + " (" + ctx.money(ev.value) + "); client says " + Math.round(pct * 100) + "% is business",
        detail: "From the client call: \"" + note.text + "\" The business share is " + ctx.money(allowed) + ", so the line is overstated by " + ctx.money(excess) + ".",
        refs: [line.key, ev.id, note.id, books.id],
        expected: ctx.money((line.value as number) - excess),
        actual: ctx.money(line.value as number),
        difference: -excess,
        effect: ctx.effect("schc_profit", excess),
      });
    }

    // Personal items booked by mistake, named in the call and itemised in the transaction detail.
    const detail = ctx.packet.documents.find((d) => d.document_type === "books_transaction_detail");
    const personal = notes.filter((n) => /personal/i.test(n.text) && /mistake|booked|not business/i.test(n.text));
    for (const note of personal) {
      const named = (ctx.index.valuesByDocument.get(detail?.id ?? "") ?? []).find((v) => isNum(v.value) && new RegExp(v.field.split("_")[0], "i").test(note.text));
      if (!named) continue;
      const account = bookValues.find((v) => isNum(v.value) && /software|subscription/i.test(v.label));
      const line = account ? lineFor(account) : undefined;
      if (!line) continue;
      out.push({
        id: "business-use:" + line.key + ":" + named.field,
        check: "business-use",
        area: "business",
        severity: "error",
        title: line.key + " includes " + ctx.money(named.value as number) + " of " + named.label + ", which the client says is personal",
        detail: "From the client call: \"" + note.text + "\" The transaction detail lists it inside " + (account?.label ?? "the account") + ".",
        refs: [line.key, named.id, note.id, ...(detail ? [detail.id] : [])],
        expected: ctx.money((line.value as number) - (named.value as number)),
        actual: ctx.money(line.value as number),
        difference: -(named.value as number),
        effect: ctx.effect("schc_profit", named.value as number),
      });
    }
    return out;
  },
};

/** The mileage log adds up page by page and drives the car expense at the standard rate. */
const mileage: Check = {
  id: "mileage",
  area: "business",
  title: "Mileage log pages add up and drive the car expense",
  coverage: (ctx) => {
    const log = ctx.packet.documents.find((d) => d.document_type === "mileage_log");
    return log ? log.page_count + " pages of the mileage log were re-added trip by trip, and the standard-mileage expense and other-miles figures were recomputed." : "No mileage log in the packet.";
  },
  run: (ctx) => {
    const out: Finding[] = [];
    const log = ctx.packet.documents.find((d) => d.document_type === "mileage_log");
    if (!log) return out;
    const values = ctx.index.valuesByDocument.get(log.id) ?? [];
    let pageTotalSum = 0;
    for (const p of log.pages) {
      const onPage = values.filter((v) => v.page === p.page);
      const trips = onPage.filter((v) => /^trip\d+_miles$/.test(v.field) && isNum(v.value)).reduce((a, v) => a + (v.value as number), 0);
      const total = onPage.find((v) => v.field === "page_total" && isNum(v.value));
      if (!total) continue;
      pageTotalSum += total.value as number;
      if (Math.abs(trips - (total.value as number)) > 0.5) {
        out.push({
          id: "mileage:page" + p.page,
          check: "mileage",
          area: "business",
          severity: "error",
          title: "Mileage log page " + p.page + " total " + ctx.money(total.value as number) + " vs trips " + ctx.money(trips),
          detail: "The page total written on the log does not equal the sum of the trips on that page.",
          refs: ["doc:" + log.id + "#page" + p.page, total.id],
          expected: ctx.money(trips),
          actual: ctx.money(total.value as number),
        });
      }
    }
    const miles = ctx.lineNum("SchC.44a");
    const rate = (ctx.packet.engine_reference.parameters as Record<string, unknown>).mileage_rate;
    const car = ctx.lineNum("SchC.9");
    if (miles !== null && isNum(rate) && car !== null) {
      const expected = Math.round(miles * rate);
      if (Math.abs(expected - car) > 1) {
        out.push({
          id: "mileage:SchC.9",
          check: "mileage",
          area: "business",
          severity: "error",
          title: "Car expense " + ctx.money(car) + " vs " + ctx.money(miles) + " miles at " + rate,
          detail: "Business miles times the standard rate gives " + ctx.money(expected) + ".",
          refs: ["SchC.9", "SchC.44a", "ref:param.mileage_rate"],
          expected: ctx.money(expected),
          actual: ctx.money(car),
          difference: expected - car,
          effect: ctx.effect("schc_profit", car - expected),
        });
      }
    }
    if (miles !== null && Math.abs(pageTotalSum - miles) > 0.5) {
      out.push({
        id: "mileage:SchC.44a",
        check: "mileage",
        area: "business",
        severity: "error",
        title: "Business miles " + ctx.money(miles) + " vs page totals " + ctx.money(pageTotalSum),
        detail: "Schedule C Part IV should equal the sum of the page totals.",
        refs: ["SchC.44a", log.id],
      });
    }
    const start = values.find((v) => v.field === "odometer_start");
    const end = values.find((v) => v.field === "odometer_end");
    const other = ctx.lineNum("SchC.44c");
    const commuting = ctx.lineNum("SchC.44b") ?? 0;
    if (start && end && isNum(start.value) && isNum(end.value) && miles !== null && other !== null) {
      const expected = end.value - start.value - miles - commuting;
      if (Math.abs(expected - other) > 0.5) {
        out.push({
          id: "mileage:SchC.44c",
          check: "mileage",
          area: "business",
          severity: "warning",
          title: "Other miles " + ctx.money(other) + " vs odometer difference " + ctx.money(expected),
          detail: "Odometer " + ctx.money(start.value) + " to " + ctx.money(end.value) + " less business and commuting miles.",
          refs: ["SchC.44c", start.id, end.id],
        });
      }
    }
    return out;
  },
};

/** Self-employment deductions sit within their statutory limits as the engine states them. */
const selfEmploymentLimits: Check = {
  id: "se-limits",
  area: "business",
  title: "SEP and health insurance deductions within their limits",
  coverage: () => "Schedule 1 lines 16 and 17 were recomputed from net profit and one-half of self-employment tax using the engine's stated rules.",
  run: (ctx) => {
    const out: Finding[] = [];
    const profit = ctx.lineNum("SchC.31");
    const halfSe = ctx.lineNum("SchSE.13");
    const sep = ctx.lineNum("Sch1.16");
    const sehi = ctx.lineNum("Sch1.17");
    if (profit === null || halfSe === null) return out;
    if (sep !== null) {
      const limit = Math.round(0.2 * (profit - halfSe));
      if (sep > limit + 1) {
        out.push({
          id: "se-limits:Sch1.16",
          check: "se-limits",
          area: "business",
          severity: "error",
          title: "SEP deduction " + ctx.money(sep) + " exceeds the 20% limit of " + ctx.money(limit),
          detail: "20% of net profit " + ctx.money(profit) + " less half SE tax " + ctx.money(halfSe) + ".",
          refs: ["Sch1.16", "SchC.31", "SchSE.13"],
          expected: ctx.money(limit),
          actual: ctx.money(sep),
        });
      }
    }
    if (sehi !== null && sep !== null) {
      const limit = profit - halfSe - sep;
      if (sehi > limit + 1) {
        out.push({
          id: "se-limits:Sch1.17",
          check: "se-limits",
          area: "business",
          severity: "error",
          title: "Self-employed health insurance " + ctx.money(sehi) + " exceeds the income limit of " + ctx.money(limit),
          detail: "Net profit less half SE tax less the SEP deduction.",
          refs: ["Sch1.17", "SchC.31", "SchSE.13", "Sch1.16"],
          expected: ctx.money(limit),
          actual: ctx.money(sehi),
        });
      }
    }
    return out;
  },
};

export const businessChecks: Check[] = [grossReceipts, businessUse, mileage, selfEmploymentLimits];

export type { CheckContext };
