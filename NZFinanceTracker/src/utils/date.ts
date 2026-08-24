import {
  addDays,
  addMonths,
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isValid,
  isWithinInterval,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { enNZ } from "date-fns/locale";
import { DATA_RETENTION_MONTHS } from "../config";
import type { DateRange } from "../types";

/** Monday is the first day of the week throughout this app. */
const WEEK_STARTS_ON = 1 as const;

/** Converts a Date to an ISO date string ("yyyy-MM-dd") for storage. */
export function toISODateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Parses a stored ISO date string ("yyyy-MM-dd") into a local Date at midnight. */
export function fromISODateString(iso: string): Date {
  const parsed = parseISO(iso);
  return startOfDay(parsed);
}

/** Formats an ISO date string using New Zealand conventions, e.g. "19/08/2026". */
export function formatNZDate(iso: string, pattern = "dd/MM/yyyy"): string {
  const date = fromISODateString(iso);
  if (!isValid(date)) return iso;
  return format(date, pattern, { locale: enNZ });
}

/** Formats a Date using New Zealand conventions, e.g. "19/08/2026". */
export function formatNZDateObj(date: Date, pattern = "dd/MM/yyyy"): string {
  return format(date, pattern, { locale: enNZ });
}

/** Formats an ISO date string as a friendly label, e.g. "Wed, 19 Aug 2026". */
export function formatNZDateFriendly(iso: string): string {
  return formatNZDate(iso, "EEE, d MMM yyyy");
}

export function getStartOfWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
}

export function getEndOfWeek(date: Date): Date {
  return endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
}

export function getStartOfMonth(date: Date): Date {
  return startOfMonth(date);
}

export function getEndOfMonth(date: Date): Date {
  return endOfMonth(date);
}

/** The earliest date for which expense data is retained, based on today. */
export function getRetentionCutoff(today: Date = new Date()): Date {
  return startOfDay(subMonths(today, DATA_RETENTION_MONTHS));
}

/** Clamps a range so it never starts before the retention cutoff or ends after today. */
export function clampRangeToRetention(range: DateRange, today: Date = new Date()): DateRange {
  const cutoff = getRetentionCutoff(today);
  const end = startOfDay(today);
  const start = maxDate([range.start, cutoff]);
  const clampedEnd = minDate([range.end, end]);
  return {
    start: isBefore(start, clampedEnd) || start.getTime() === clampedEnd.getTime() ? start : clampedEnd,
    end: clampedEnd,
  };
}

export function getThisWeekRange(today: Date = new Date()): DateRange {
  return { start: getStartOfWeek(today), end: getEndOfWeek(today) };
}

export function getLastWeekRange(today: Date = new Date()): DateRange {
  const lastWeekAnchor = subWeeks(today, 1);
  return { start: getStartOfWeek(lastWeekAnchor), end: getEndOfWeek(lastWeekAnchor) };
}

export function getThisMonthRange(today: Date = new Date()): DateRange {
  return { start: getStartOfMonth(today), end: getEndOfMonth(today) };
}

export function getLastMonthRange(today: Date = new Date()): DateRange {
  const lastMonthAnchor = subMonths(today, 1);
  return { start: getStartOfMonth(lastMonthAnchor), end: getEndOfMonth(lastMonthAnchor) };
}

export function isDateWithinRange(iso: string, range: DateRange): boolean {
  const date = fromISODateString(iso);
  return isWithinInterval(date, { start: startOfDay(range.start), end: startOfDay(range.end) });
}

export function isMoreThanRetentionOld(iso: string, today: Date = new Date()): boolean {
  const date = fromISODateString(iso);
  return isBefore(date, getRetentionCutoff(today));
}

/** All days (Mon-Sun) in the given range, inclusive. */
export function getDaysInRange(range: DateRange): Date[] {
  return eachDayOfInterval({ start: startOfDay(range.start), end: startOfDay(range.end) });
}

/** All week-start dates (Mondays) whose week overlaps the given range. */
export function getWeeksInRange(range: DateRange): Date[] {
  return eachWeekOfInterval(
    { start: startOfDay(range.start), end: startOfDay(range.end) },
    { weekStartsOn: WEEK_STARTS_ON },
  );
}

export function isTodayOrEarlier(date: Date, today: Date = new Date()): boolean {
  return !isAfter(startOfDay(date), startOfDay(today));
}

export { addDays, addMonths, startOfDay, subDays };
