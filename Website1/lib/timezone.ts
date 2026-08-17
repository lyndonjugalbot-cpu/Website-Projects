import { BUSINESS_UTC_OFFSET_HOURS } from "@/lib/store-config";

/**
 * Converts a "YYYY-MM-DD" date (as picked in a Reports date filter, meant
 * in Asia/Manila local time) to the UTC instant of that day's start
 * (00:00:00 Manila time). Safe to compute with a fixed offset since the
 * Philippines doesn't observe daylight saving time.
 */
export function manilaDayStartUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+08:00`);
}

/** UTC instant of the *end* of the given Manila-local day (exclusive upper bound = next day's start). */
export function manilaDayEndUtc(dateStr: string): Date {
  const start = manilaDayStartUtc(dateStr);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/** Today's date as "YYYY-MM-DD" in Asia/Manila, for defaulting report filters. */
export function todayInManila(): string {
  const nowUtc = new Date();
  const manila = new Date(nowUtc.getTime() + BUSINESS_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 10);
}

const manilaDateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatManilaDateTime(date: Date): string {
  return manilaDateTimeFormatter.format(date);
}
