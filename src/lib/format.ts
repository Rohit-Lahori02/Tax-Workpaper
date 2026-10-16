const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function fmtMoney(n: number): string {
  return money.format(n);
}

/** Balance due is positive; a negative balance is a refund. */
export function fmtBalance(n: number): string {
  return n < 0 ? `${money.format(-n)} refund` : money.format(n);
}

export function fmtNumber(n: number): string {
  return number.format(n);
}

export function fmtPct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export function fmtLineValue(value: number | string): string {
  return typeof value === "number" ? number.format(value) : value;
}

export function fmtExtractedValue(value: string | number | boolean | null): string {
  if (value === null) return "(nothing printed)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return number.format(value);
  return value;
}

export function filingStatusLabel(code: string): string {
  return code.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
