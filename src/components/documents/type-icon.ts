import { BookOpen, FileSignature, FileText, IdCard, Landmark, Mail, Receipt } from "lucide-react";

/** An icon for a document type. Plain module so server and client components can both use it. */
export function typeIcon(type: string) {
  if (/identity|license|passport|social/i.test(type)) return IdCard;
  if (/engagement|consent|8879|signature/i.test(type)) return FileSignature;
  if (/books|ledger|profit|transaction|report/i.test(type)) return BookOpen;
  if (/bank|statement|brokerage|composite|closing|payoff/i.test(type)) return Landmark;
  if (/receipt|invoice|confirmation|donation/i.test(type)) return Receipt;
  if (/notice|letter|transcript/i.test(type)) return Mail;
  return FileText;
}
