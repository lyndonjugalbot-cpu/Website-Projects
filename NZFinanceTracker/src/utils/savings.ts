import type { Budgets, Expense, ReportView, SavingsEntry } from "../types";
import {
  addDays,
  addMonths,
  formatNZDate,
  fromISODateString,
  getEndOfMonth,
  getEndOfWeek,
  getStartOfMonth,
  getStartOfWeek,
  toISODateString,
} from "./date";
import { computeRealizedSavings } from "./forecast";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Net amount currently set aside: every deposit minus every withdrawal. */
export function getSavingsBalance(entries: SavingsEntry[]): number {
  return round2(entries.reduce((sum, entry) => sum + entry.amount, 0));
}

/** Total of all money added to savings (deposits only). */
export function getTotalDeposited(entries: SavingsEntry[]): number {
  return round2(entries.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0));
}

/** Total of all money taken out of savings, as a positive number. */
export function getTotalWithdrawn(entries: SavingsEntry[]): number {
  return round2(entries.filter((e) => e.amount < 0).reduce((sum, e) => sum - e.amount, 0));
}

/** Deposits that came from an automatic weekly/monthly goal contribution. */
export function getAutoContributed(entries: SavingsEntry[]): number {
  return round2(
    entries.filter((e) => e.source !== "manual").reduce((sum, e) => sum + e.amount, 0),
  );
}

const MAX_WEEK_BUCKETS = 26;
const MAX_MONTH_BUCKETS = 12;

export interface SavingsTimelinePoint {
  key: string;
  label: string;
  /** Cumulative recorded savings balance at the end of this period. */
  balance: number;
  /**
   * Cumulative budget-based savings: for each past period, how much of the goal
   * your under-spend actually covered, added up. Null when no savings goal is set.
   */
  realized: number | null;
}

export interface SavingsTimeline {
  points: SavingsTimelinePoint[];
  hasRealized: boolean;
  /** Human label for the window the chart covers, e.g. "last 26 weeks". */
  windowLabel: string;
}

/**
 * Builds the "savings over time" series: the recorded balance stepping up and
 * down with each entry, and — when a savings goal exists — a cumulative
 * budget-based savings line alongside it. Bucketed by week or month to match the
 * report view, over a bounded trailing window.
 */
export function buildSavingsTimeline(
  entries: SavingsEntry[],
  expenses: Expense[],
  budgets: Budgets,
  view: ReportView,
): SavingsTimeline {
  const weekly = view === "weekly";
  const budget = weekly ? budgets.weekly : budgets.monthly;
  const goal = weekly ? budgets.savingsWeekly : budgets.savingsMonthly;
  const hasRealized = budget !== null && goal !== null;
  const maxBuckets = weekly ? MAX_WEEK_BUCKETS : MAX_MONTH_BUCKETS;
  const windowLabel = `last ${maxBuckets} ${weekly ? "weeks" : "months"}`;

  const dates = [...entries.map((e) => e.date), ...expenses.map((e) => e.date)];
  if (dates.length === 0) return { points: [], hasRealized, windowLabel };

  const startOfPeriod = weekly ? getStartOfWeek : getStartOfMonth;
  const endOfPeriod = weekly ? getEndOfWeek : getEndOfMonth;
  const prevPeriod = (d: Date) => (weekly ? addDays(d, -7) : addMonths(d, -1));

  const earliestStart = startOfPeriod(fromISODateString(dates.reduce((a, b) => (a < b ? a : b))));
  const starts: Date[] = [];
  let cursor = startOfPeriod(new Date());
  for (let i = 0; i < maxBuckets; i += 1) {
    starts.unshift(cursor);
    if (cursor <= earliestStart) break;
    cursor = prevPeriod(cursor);
  }

  let cumulativeRealized = 0;
  const points = starts.map((periodStart) => {
    const startISO = toISODateString(periodStart);
    const endISO = toISODateString(endOfPeriod(periodStart));

    const balance = round2(
      entries.filter((e) => e.date <= endISO).reduce((sum, e) => sum + e.amount, 0),
    );

    let realized: number | null = null;
    if (hasRealized) {
      const spent = expenses
        .filter((e) => e.date >= startISO && e.date <= endISO)
        .reduce((sum, e) => sum + e.amount, 0);
      cumulativeRealized = round2(
        cumulativeRealized + (computeRealizedSavings(budget, goal, spent) ?? 0),
      );
      realized = cumulativeRealized;
    }

    return {
      key: startISO,
      label: weekly ? formatNZDate(startISO, "d MMM") : formatNZDate(startISO, "MMM yy"),
      balance,
      realized,
    };
  });

  return { points, hasRealized, windowLabel };
}
