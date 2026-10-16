import type { Packet } from "@/lib/packet/schema";

const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const SENSITIVE_KEY = /^(ssn|ip_pin|account|routing|account_number)$/i;
const DOT = "•";

export function maskSsn(ssn: string): string {
  const digits = ssn.replace(/\D/g, "");
  return `${DOT.repeat(3)}-${DOT.repeat(2)}-${digits.slice(-4)}`;
}

export function maskAccount(value: string): string {
  const digits = value.replace(/\D/g, "");
  return `${DOT.repeat(4)} ${digits.slice(-4)}`;
}

export function maskPin(): string {
  return DOT.repeat(6);
}

/** Literal strings that must never appear unmasked to an uncleared viewer. */
export function sensitiveLiterals(packet: Packet): string[] {
  const out: string[] = [];
  for (const p of packet.household.people) {
    if (p.ssn) out.push(p.ssn);
    if (p.ip_pin) out.push(p.ip_pin);
  }
  const bank = packet.household.bank_account_for_refund_or_payment;
  out.push(bank.account, bank.routing);
  return out.filter((s) => s.length >= 4);
}

/** Masks SSN-shaped text and any known sensitive literal inside free text. */
export function maskText(text: string, literals: string[]): string {
  let out = text.replace(SSN_PATTERN, (m) => maskSsn(m));
  for (const lit of literals) {
    if (lit.length < 4) continue;
    out = out.split(lit).join(maskAccount(lit));
  }
  return out;
}

/** Deep copy with sensitive keys masked and free text scrubbed. */
export function redactDeep<T>(value: T, literals: string[]): T {
  const walk = (v: unknown, key?: string): unknown => {
    if (v === null || v === undefined) return v;
    if (typeof v === "string") {
      if (key && SENSITIVE_KEY.test(key)) {
        if (/ssn/i.test(key)) return maskSsn(v);
        if (/pin/i.test(key)) return maskPin();
        return maskAccount(v);
      }
      return maskText(v, literals);
    }
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = walk(x, k);
      return out;
    }
    return v;
  };
  return walk(value) as T;
}
