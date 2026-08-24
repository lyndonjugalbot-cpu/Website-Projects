import { ESSENTIAL_CATEGORIES, type ExpenseCategory } from "../config";
import type { Frequency, Income, RecurringExpense } from "../types";
import { addDays, addMonths, formatNZDate, fromISODateString, toISODateString } from "./date";

function stepDate(iso: string, frequency: Frequency): string {
  const date = fromISODateString(iso);
  switch (frequency) {
    case "weekly":
      return toISODateString(addDays(date, 7));
    case "fortnightly":
      return toISODateString(addDays(date, 14));
    case "monthly":
      return toISODateString(addMonths(date, 1));
  }
}

/**
 * Occurrence dates of a recurring anchor date within [windowStart, windowEnd].
 * Self-healing: if the anchor has drifted into the past (nothing has advanced it
 * since it was set), it's rolled forward to the window instead of erroring.
 */
export function getOccurrencesInWindow(
  anchorISO: string,
  frequency: Frequency,
  windowStartISO: string,
  windowEndISO: string,
): string[] {
  const occurrences: string[] = [];
  let cursor = anchorISO;
  let guard = 0;
  while (cursor < windowStartISO && guard < 2000) {
    cursor = stepDate(cursor, frequency);
    guard += 1;
  }
  while (cursor <= windowEndISO && guard < 4000) {
    occurrences.push(cursor);
    cursor = stepDate(cursor, frequency);
    guard += 1;
  }
  return occurrences;
}

export interface ForecastPoint {
  date: string;
  label: string;
  balance: number;
}

export interface ProjectBalanceParams {
  startingBalance: number;
  income: Income | null;
  recurringExpenses: RecurringExpense[];
  /** Estimated flat daily spend for everything not covered by a recurring expense. */
  historicalDailyAverage: number;
  horizonDays: number;
  today?: Date;
}

/** Projects account balance forward day-by-day: starting balance + income − recurring bills − estimated variable spend. */
export function projectBalance({
  startingBalance,
  income,
  recurringExpenses,
  historicalDailyAverage,
  horizonDays,
  today = new Date(),
}: ProjectBalanceParams): ForecastPoint[] {
  const todayISO = toISODateString(today);
  const endISO = toISODateString(addDays(today, horizonDays));

  const incomeDates = income
    ? new Set(getOccurrencesInWindow(income.nextPayDate, income.frequency, todayISO, endISO))
    : new Set<string>();

  const expenseTotalsByDate = new Map<string, number>();
  for (const expense of recurringExpenses) {
    if (!expense.active) continue;
    for (const date of getOccurrencesInWindow(expense.nextDueDate, expense.frequency, todayISO, endISO)) {
      expenseTotalsByDate.set(date, (expenseTotalsByDate.get(date) ?? 0) + expense.amount);
    }
  }

  let balance = startingBalance;
  const points: ForecastPoint[] = [];
  for (let i = 0; i <= horizonDays; i++) {
    const date = toISODateString(addDays(today, i));
    if (i > 0) balance -= historicalDailyAverage;
    if (income && incomeDates.has(date)) balance += income.amount;
    const dueToday = expenseTotalsByDate.get(date);
    if (dueToday) balance -= dueToday;
    points.push({ date, label: formatNZDate(date, "d MMM"), balance: Math.round(balance * 100) / 100 });
  }
  return points;
}

/** First point where the projection dips below zero, or null if it stays non-negative through the horizon. */
export function findFirstNegativeDay(points: ForecastPoint[]): ForecastPoint | null {
  return points.find((point) => point.balance < 0) ?? null;
}

const DISCRETIONARY_PRIORITY: ExpenseCategory[] = [
  "Eating out",
  "Entertainment",
  "Shopping",
  "Subscriptions",
  "Transport",
  "Groceries",
  "Other",
];

export interface SavingSuggestion {
  category: ExpenseCategory;
  /** Spend in this category, scaled to the forecast horizon. */
  projectedSpend: number;
  suggestedCut: number;
}

export interface SuggestSavingsParams {
  /** How much the projection needs to close by, in dollars. */
  deficit: number;
  /** Category totals over the same trailing window used for historicalDailyAverage. */
  categoryTotals: Record<ExpenseCategory, number>;
  /** Number of days categoryTotals covers. */
  windowDays: number;
  horizonDays: number;
}

/** Ranks discretionary categories and suggests trims (up to half of projected spend each) that together close the deficit. */
export function suggestSavings({
  deficit,
  categoryTotals,
  windowDays,
  horizonDays,
}: SuggestSavingsParams): SavingSuggestion[] {
  if (deficit <= 0) return [];
  const scale = horizonDays / windowDays;
  let remaining = deficit;
  const suggestions: SavingSuggestion[] = [];

  for (const category of DISCRETIONARY_PRIORITY) {
    if (remaining <= 0) break;
    if (ESSENTIAL_CATEGORIES.includes(category)) continue;
    const projectedSpend = (categoryTotals[category] ?? 0) * scale;
    if (projectedSpend <= 0) continue;
    const cut = Math.min(projectedSpend * 0.5, remaining);
    if (cut < 1) continue;
    suggestions.push({
      category,
      projectedSpend: Math.round(projectedSpend * 100) / 100,
      suggestedCut: Math.round(cut * 100) / 100,
    });
    remaining -= cut;
  }
  return suggestions;
}

/** Savings realized for a period, carved out of the budget: min(goal, max(0, budget − actualSpend)). */
export function computeRealizedSavings(
  budget: number | null,
  savingsGoal: number | null,
  actualSpend: number,
): number | null {
  if (budget === null || savingsGoal === null) return null;
  return Math.min(savingsGoal, Math.max(0, budget - actualSpend));
}
