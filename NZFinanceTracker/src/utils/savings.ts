import type { Budgets, Expense, PeriodBudget, ReportView, SavingsEntry } from "../types";
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
import { computePeriodSavingsImpact, findExplicitPeriodBudget, resolveGrossBudget } from "./periodBudget";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Hand-recorded movements only. Automatic savings are derived, never stored as entries. */
function manualEntries(entries: SavingsEntry[]): SavingsEntry[] {
  return entries.filter((entry) => entry.source === "manual");
}

/** Net amount set aside by hand: every manual deposit minus every manual withdrawal. */
export function getManualBalance(entries: SavingsEntry[]): number {
  return round2(manualEntries(entries).reduce((sum, entry) => sum + entry.amount, 0));
}

/** Total of all money added to savings by hand (deposits only). */
export function getTotalDeposited(entries: SavingsEntry[]): number {
  return round2(
    manualEntries(entries)
      .filter((e) => e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0),
  );
}

/** Total of all money taken out of savings, as a positive number. */
export function getTotalWithdrawn(entries: SavingsEntry[]): number {
  return round2(
    manualEntries(entries)
      .filter((e) => e.amount < 0)
      .reduce((sum, e) => sum - e.amount, 0),
  );
}

const MAX_WEEK_BUCKETS = 26;
const MAX_MONTH_BUCKETS = 12;

export interface SavingsTimelinePoint {
  key: string;
  label: string;
  /** Cumulative savings set aside by the end of this period: manual entries + automatic savings kept. */
  balance: number;
  /**
   * Cumulative target: what would be saved if nothing were overspent (manual entries +
   * the full automatic-savings slice for each period). Null when no automatic savings is set.
   */
  target: number | null;
}

export interface SavingsTimeline {
  points: SavingsTimelinePoint[];
  hasTarget: boolean;
  /** Human label for the window the chart covers, e.g. "last 26 weeks". */
  windowLabel: string;
}

/**
 * Builds the "savings over time" series: money actually set aside (manual entries plus the
 * automatic savings that survived each period's spending), and — when an automatic-savings
 * amount is set — the target line it would have hit with no overspend. Bucketed by week or
 * month to match the report view, over a bounded trailing window.
 */
export function buildSavingsTimeline(
  entries: SavingsEntry[],
  expenses: Expense[],
  periodBudgets: PeriodBudget[],
  budgets: Budgets,
  view: ReportView,
): SavingsTimeline {
  const weekly = view === "weekly";
  const carveOut = weekly ? budgets.savingsWeekly : budgets.savingsMonthly;
  const hasTarget = carveOut !== null && carveOut > 0;
  const maxBuckets = weekly ? MAX_WEEK_BUCKETS : MAX_MONTH_BUCKETS;
  const windowLabel = `last ${maxBuckets} ${weekly ? "weeks" : "months"}`;

  const manual = manualEntries(entries);
  const dates = [...manual.map((e) => e.date), ...expenses.map((e) => e.date)];
  if (dates.length === 0) return { points: [], hasTarget, windowLabel };

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

  let cumulativeKept = 0;
  let cumulativePlanned = 0;
  const points = starts.map((periodStart) => {
    const startISO = toISODateString(periodStart);
    const endISO = toISODateString(endOfPeriod(periodStart));

    const manualToDate = round2(
      manual.filter((e) => e.date <= endISO).reduce((sum, e) => sum + e.amount, 0),
    );

    const periodExpenses = expenses.filter((e) => e.date >= startISO && e.date <= endISO);
    const spent = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
    const grossBudget = resolveGrossBudget(periodBudgets, budgets, view, startISO);
    // Only periods the user actually used count toward automatic savings.
    const counts =
      findExplicitPeriodBudget(periodBudgets, view, startISO) !== undefined || periodExpenses.length > 0;
    const impact = counts
      ? computePeriodSavingsImpact({ grossBudget, carveOut, spent })
      : null;
    cumulativeKept = round2(cumulativeKept + (impact?.keptSavings ?? 0));
    cumulativePlanned = round2(cumulativePlanned + (impact?.plannedSavings ?? 0));

    return {
      key: startISO,
      label: weekly ? formatNZDate(startISO, "d MMM") : formatNZDate(startISO, "MMM yy"),
      balance: round2(manualToDate + cumulativeKept),
      target: hasTarget ? round2(manualToDate + cumulativePlanned) : null,
    };
  });

  return { points, hasTarget, windowLabel };
}
