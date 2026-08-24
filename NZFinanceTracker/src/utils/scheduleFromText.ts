import * as chrono from "chrono-node";
import { toISODateString } from "./date";

export interface ParsedSchedule {
  date: string; // ISO "yyyy-MM-dd"
  /** "HH:mm", or null if the text only implied a day, not a specific time. */
  time: string | null;
  /** The substring chrono matched, shown to the user so an auto-fill doesn't feel unexplained. */
  matchedText: string;
}

/** Finds the first date/time reference in free text, e.g. "remind me at 6pm today" or "next Monday". */
export function parseScheduleFromText(text: string, referenceDate: Date = new Date()): ParsedSchedule | null {
  const results = chrono.parse(text, referenceDate, { forwardDate: true });
  if (results.length === 0) return null;

  const result = results[0];
  const date = result.start.date();
  const hasTime = result.start.isCertain("hour");

  return {
    date: toISODateString(date),
    time: hasTime ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : null,
    matchedText: result.text,
  };
}
