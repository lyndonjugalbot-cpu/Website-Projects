const nzdFormatter = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nzdFormatterNoDecimals = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formats a number as NZD, e.g. 25.5 -> "$25.50" */
export function formatNZD(amount: number): string {
  if (!Number.isFinite(amount)) return "$0.00";
  return nzdFormatter.format(amount);
}

/** Formats a number as NZD without decimals, for compact axis labels */
export function formatNZDCompact(amount: number): string {
  if (!Number.isFinite(amount)) return "$0";
  return nzdFormatterNoDecimals.format(amount);
}

/** Parses a raw string into a number rounded to cents, or null if invalid */
export function parseAmountInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}
