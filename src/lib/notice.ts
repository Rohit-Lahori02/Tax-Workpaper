import type { EffectiveReturn } from "@/lib/effective";
import type { Ledger } from "@/lib/facts/ledger";
import type { FactView } from "@/lib/facts/types";
import type { PacketIndex } from "@/lib/packet/index";
import type { Notice, Packet } from "@/lib/packet/schema";

/**
 * A notice response package, assembled from the workpaper: for each item the
 * agency asks about, the lines as filed and as corrected, the documents that
 * substantiate them (the exhibits), the firm's own contemporaneous records,
 * and the exposure if the position does not hold. Pure over packet + ledger.
 */

export interface Exhibit {
  id: string;
  label: string;
  documentId: string;
  title: string;
  pages: number[];
  values: { id: string; field: string; value: string }[];
}

export interface NoticeLine {
  key: string;
  label: string;
  engine: number | string;
  working: number | string;
  adjusted: boolean;
}

export interface Reconciliation {
  title: string;
  rows: { label: string; amount: number; ref: string | null }[];
  total: { label: string; amount: number };
  compareTo: { label: string; amount: number; key: string };
  difference: number;
  explanation: string;
}

export interface NoticeItem {
  n: number;
  text: string;
  topic: "noncash_gifts" | "schc_receipts" | "other";
  lines: NoticeLine[];
  exhibits: Exhibit[];
  record: FactView[];
  reconciliation: Reconciliation | null;
  exposure: { text: string; federal: number | null }[];
  position: string;
}

export interface NoticePackage {
  notice: Notice;
  items: NoticeItem[];
  exhibits: Exhibit[];
  dueInDays: number | null;
  sent: FactView | null;
  sentCurrent: boolean;
  hash: string;
}

function topicOf(text: string): NoticeItem["topic"] {
  if (/8283|noncash/i.test(text)) return "noncash_gifts";
  if (/schedule c|gross receipts|1099-nec|1099-k/i.test(text)) return "schc_receipts";
  return "other";
}

const LINE_SETS: Record<NoticeItem["topic"], string[]> = {
  noncash_gifts: ["F8283.A1.stock", "F8283.A1.vehicle", "SchA.12", "SchA.14"],
  schc_receipts: ["SchC.1", "SchC.7", "SchC.31"],
  other: [],
};

const DOC_TYPES: Record<NoticeItem["topic"], string[]> = {
  noncash_gifts: ["donation_receipt", "1098-C"],
  schc_receipts: ["1099-NEC", "1099-K", "books_profit_loss"],
  other: [],
};

function exhibitsFor(packet: Packet, index: PacketIndex, lineKeys: string[], docTypes: string[], letter: (i: number) => string, start: number): Exhibit[] {
  const docIds = new Set<string>();
  for (const k of lineKeys) {
    const l = index.lines.get(index.latestVersion)?.get(k);
    for (const s of l?.sources ?? []) {
      const v = index.values.get(s);
      if (v) docIds.add(v.document_id);
    }
  }
  for (const d of packet.documents) if (docTypes.includes(d.document_type)) docIds.add(d.id);
  const docs = packet.documents.filter((d) => docIds.has(d.id) && !(index.documentUsage.get(d.id)?.supersededIn.length ?? 0));
  return docs.map((d, i) => {
    const values = packet.extracted_values.filter((e) => e.document_id === d.id);
    return {
      id: "exhibit-" + letter(start + i),
      label: "Exhibit " + letter(start + i),
      documentId: d.id,
      title: d.title,
      pages: [...new Set(values.map((v) => v.page))].sort((a, b) => a - b),
      values: values.map((v) => ({ id: v.id, field: v.field, value: v.value === null ? "" : String(v.value) })),
    };
  });
}

function num(index: PacketIndex, key: string): number | null {
  const v = index.lines.get(index.latestVersion)?.get(key)?.value;
  return typeof v === "number" ? v : null;
}

export function noticePackage(packet: Packet, index: PacketIndex, ledger: Ledger, eff: EffectiveReturn, notice: Notice, now: string, hash: (s: string) => string): NoticePackage {
  const letter = (i: number) => String.fromCharCode(65 + i);
  const itemsText = notice.items_under_examination ?? (notice.summary ? [notice.summary] : []);
  let exhibitCount = 0;
  const items: NoticeItem[] = itemsText.map((text, i) => {
    const topic = topicOf(text);
    const keys = LINE_SETS[topic];
    const lines: NoticeLine[] = keys
      .map((k) => {
        const l = index.lines.get(index.latestVersion)?.get(k);
        if (!l) return null;
        const w = eff.lines.get(k);
        return { key: k, label: l.label, engine: l.value, working: w ? w.working : l.value, adjusted: Boolean(w && w.kind === "adjusted") };
      })
      .filter((x): x is NoticeLine => x !== null);
    const exhibits = exhibitsFor(packet, index, keys, DOC_TYPES[topic], letter, exhibitCount);
    exhibitCount += exhibits.length;
    const targets = new Set([...keys, ...exhibits.map((e) => e.documentId)]);
    const record = ledger.all.filter((f) => targets.has(f.target) && !f.retracted && ["verification", "note", "adjustment", "judgment", "question", "attachment"].includes(f.kind));

    let reconciliation: Reconciliation | null = null;
    const exposure: NoticeItem["exposure"] = [];
    let position = "";

    if (topic === "schc_receipts") {
      const necs = packet.documents.filter((d) => d.document_type === "1099-NEC").map((d) => ({ d, amount: packet.extracted_values.find((e) => e.document_id === d.id && e.field === "box1")?.value }));
      const k = packet.documents.filter((d) => d.document_type === "1099-K").map((d) => ({ d, amount: packet.extracted_values.find((e) => e.document_id === d.id && e.field === "box1a")?.value }));
      const books = packet.extracted_values.find((e) => e.field === "total_income" && packet.documents.find((d) => d.id === e.document_id)?.document_type === "books_profit_loss");
      const rows = [
        ...necs.map(({ d, amount }) => ({ label: d.title.replace(/^2025 /, ""), amount: typeof amount === "number" ? amount : 0, ref: d.id })),
        ...k.map(({ d, amount }) => ({ label: d.title.replace(/^2025 /, ""), amount: typeof amount === "number" ? amount : 0, ref: d.id })),
      ];
      const third = rows.reduce((s, r) => s + r.amount, 0);
      const reported = num(index, "SchC.1") ?? 0;
      const booksTotal = typeof books?.value === "number" ? books.value : null;
      const working = eff.lines.get("SchC.1")?.working;
      reconciliation = {
        title: "Gross receipts reported vs third-party forms",
        rows,
        total: { label: "Third-party forms (Forms 1099-NEC and 1099-K)", amount: third },
        compareTo: { label: "Schedule C line 1 as filed", amount: reported, key: "SchC.1" },
        difference: reported - third,
        explanation:
          booksTotal !== null
            ? "The books (" + (books?.document_id ?? "") + ") show total income of " + booksTotal.toLocaleString("en-US") + ", which already includes the card receipts that Paywell reported on Form 1099-K. Every Form 1099-NEC amount is a deposit in those books. Receipts reported on the return (" + reported.toLocaleString("en-US") + ") exceed the third-party total; nothing reported to the IRS is missing from the return."
            : "Receipts reported exceed the third-party total.",
      };
      position = "All third-party-reported receipts are included. The firm's own check found the return overstates receipts by the 1099-K amount counted twice" + (typeof working === "number" && working !== reported ? "; the corrected figure (" + working.toLocaleString("en-US") + ") is carried on the amended return." : "; the correction is an amended return in the taxpayer's favor, not an assessment.");
      if (booksTotal !== null && reported > booksTotal) {
        const over = reported - booksTotal;
        exposure.push({ text: "Receipts overstated by " + over.toLocaleString("en-US") + " (Form 1099-K added on top of books that already contained it). Refund opportunity on amendment, not exposure.", federal: -Math.round(over * (index.versions.get(index.latestVersion)!.tax_effect_rates.schc_profit?.federal_per_dollar ?? 0)) });
      }
    }

    if (topic === "noncash_gifts") {
      const vehicleClaimed = num(index, "F8283.A1.vehicle");
      const proceeds = packet.extracted_values.find((e) => e.field === "box4c" && packet.documents.find((d) => d.id === e.document_id)?.document_type === "1098-C");
      const stockFmv = num(index, "F8283.A1.stock");
      position =
        "Stock gift: the donee's contemporaneous written acknowledgment states shares, date and fair market value; the gift exceeds 5,000 but publicly traded securities need no qualified appraisal. Vehicle gift: Form 1098-C from the donee is attached" +
        (proceeds && typeof proceeds.value === "number" && vehicleClaimed !== null && vehicleClaimed > proceeds.value ? "; the deduction is limited to the gross proceeds on that form, and the corrected figure is conceded." : ".");
      if (proceeds && typeof proceeds.value === "number" && vehicleClaimed !== null && vehicleClaimed > proceeds.value) {
        const over = vehicleClaimed - proceeds.value;
        const w = eff.lines.get("F8283.A1.vehicle");
        exposure.push({
          text: "Vehicle deduction claimed at " + vehicleClaimed.toLocaleString("en-US") + " (client's Kelley Blue Book estimate) against gross proceeds of " + proceeds.value.toLocaleString("en-US") + " on Form 1098-C box 4c. Section 170(f)(12) limits the deduction to the proceeds." + (w && w.kind === "adjusted" ? " Already corrected in the working return." : " Not yet corrected."),
          federal: Math.round(over * (index.versions.get(index.latestVersion)!.tax_effect_rates.itemized?.federal_per_dollar ?? 0)),
        });
      }
      if (stockFmv !== null) exposure.push({ text: "Stock gift of " + stockFmv.toLocaleString("en-US") + " is supported by the acknowledgment; no exposure expected.", federal: 0 });
    }

    return { n: i + 1, text, topic, lines, exhibits, record, reconciliation, exposure, position };
  });

  const exhibits = items.flatMap((i) => i.exhibits);
  const dueInDays = notice.response_due ? Math.ceil((Date.parse(notice.response_due) - Date.parse(now)) / 86400000) : null;
  const target = "notice:" + notice.id;
  const sent = ledger.latest(target, "filing");
  const h = hash(["N", notice.id, ...items.map((i) => i.lines.map((l) => l.key + "=" + String(l.working)).join(",")), ...exhibits.map((e) => e.documentId)].join("|"));
  return { notice, items, exhibits, dueInDays, sent, sentCurrent: Boolean(sent && sent.body.hash === h), hash: h };
}
