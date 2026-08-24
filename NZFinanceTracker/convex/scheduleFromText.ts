import * as chrono from "chrono-node";

export interface ParsedSchedule {
  date: string; // ISO "yyyy-MM-dd"
  time: string | null; // "HH:mm"
}

/**
 * A Date whose local getters (getFullYear/getHours/etc.) read back NZ wall-clock time,
 * regardless of the actual timezone this Convex deployment runs in. Needed because chrono
 * resolves phrases like "today" / "6pm" relative to those local getters.
 */
function nzNow(): Date {
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

function toLocalISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Mirrors src/utils/scheduleFromText.ts (duplicated rather than imported so this deployment
 * has no dependency on the frontend source tree, matching the convention in constants.ts).
 */
export function parseScheduleFromText(text: string, referenceDate: Date = nzNow()): ParsedSchedule | null {
  const results = chrono.parse(text, referenceDate, { forwardDate: true });
  if (results.length === 0) return null;

  const result = results[0];
  const date = result.start.date();
  const hasTime = result.start.isCertain("hour");

  return {
    date: toLocalISODate(date),
    time: hasTime ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : null,
  };
}
