import { EXPENSE_CATEGORIES, type ExpenseCategory } from "../config";
import type { DateRange, Expense } from "../types";
import { formatNZDate, getDaysInRange, getStartOfWeek, isDateWithinRange, startOfDay, subDays, toISODateString } from "./date";

export function filterExpensesByRange(expenses: Expense[], range: DateRange): Expense[] {
  return expenses.filter((expense) => isDateWithinRange(expense.date, range));
}

export function searchExpenses(expenses: Expense[], query: string): Expense[] {
  const q = query.trim().toLowerCase();
  if (!q) return expenses;
  return expenses.filter(
    (expense) =>
      expense.description.toLowerCase().includes(q) || expense.notes.toLowerCase().includes(q),
  );
}

export function filterExpensesByCategory(
  expenses: Expense[],
  category: ExpenseCategory | "All",
): Expense[] {
  if (category === "All") return expenses;
  return expenses.filter((expense) => expense.category === category);
}

export function sortExpenses(
  expenses: Expense[],
  sortBy: "newest" | "oldest" | "highest" | "lowest",
): Expense[] {
  const sorted = [...expenses];
  switch (sortBy) {
    case "newest":
      return sorted.sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      );
    case "oldest":
      return sorted.sort(
        (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
      );
    case "highest":
      return sorted.sort((a, b) => b.amount - a.amount);
    case "lowest":
      return sorted.sort((a, b) => a.amount - b.amount);
    default:
      return sorted;
  }
}

export function getTotalSpent(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

export function getAveragePurchase(expenses: Expense[]): number {
  if (expenses.length === 0) return 0;
  return getTotalSpent(expenses) / expenses.length;
}

export function getLargestPurchase(expenses: Expense[]): Expense | null {
  if (expenses.length === 0) return null;
  return expenses.reduce((largest, expense) => (expense.amount > largest.amount ? expense : largest));
}

export function getMostUsedCategory(expenses: Expense[]): ExpenseCategory | null {
  if (expenses.length === 0) return null;
  const counts = groupCountByCategory(expenses);
  let topCategory: ExpenseCategory | null = null;
  let topCount = 0;
  for (const category of EXPENSE_CATEGORIES) {
    const count = counts[category] ?? 0;
    if (count > topCount) {
      topCount = count;
      topCategory = category;
    }
  }
  return topCategory;
}

export function groupSpendingByCategory(expenses: Expense[]): Record<ExpenseCategory, number> {
  const totals = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0])) as Record<
    ExpenseCategory,
    number
  >;
  for (const expense of expenses) {
    totals[expense.category] += expense.amount;
  }
  return totals;
}

function groupCountByCategory(expenses: Expense[]): Record<ExpenseCategory, number> {
  const counts = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0])) as Record<
    ExpenseCategory,
    number
  >;
  for (const expense of expenses) {
    counts[expense.category] += 1;
  }
  return counts;
}

export interface DaySpending {
  date: string;
  label: string;
  total: number;
  count: number;
}

/** Spending totals for every day in the range, in chronological order. Days without expenses show 0. */
export function groupSpendingByDay(expenses: Expense[], range: DateRange): DaySpending[] {
  const totalsByDate = new Map<string, { total: number; count: number }>();
  for (const expense of expenses) {
    const existing = totalsByDate.get(expense.date) ?? { total: 0, count: 0 };
    existing.total += expense.amount;
    existing.count += 1;
    totalsByDate.set(expense.date, existing);
  }
  return getDaysInRange(range).map((day) => {
    const iso = toISODateString(day);
    const entry = totalsByDate.get(iso) ?? { total: 0, count: 0 };
    return {
      date: iso,
      label: formatNZDate(iso, "EEE d MMM"),
      total: Math.round(entry.total * 100) / 100,
      count: entry.count,
    };
  });
}

export interface WeekSpending {
  weekStart: string;
  label: string;
  total: number;
  count: number;
}

/** Spending totals for each Monday-start week that overlaps the range. */
export function groupSpendingByWeek(expenses: Expense[], range: DateRange): WeekSpending[] {
  const byWeek = new Map<string, { total: number; count: number }>();
  for (const expense of expenses) {
    const weekStart = toISODateString(getStartOfWeek(new Date(expense.date)));
    const existing = byWeek.get(weekStart) ?? { total: 0, count: 0 };
    existing.total += expense.amount;
    existing.count += 1;
    byWeek.set(weekStart, existing);
  }

  const weekStarts = new Set<string>(byWeek.keys());
  for (const day of getDaysInRange(range)) {
    weekStarts.add(toISODateString(getStartOfWeek(day)));
  }

  return Array.from(weekStarts)
    .sort()
    .map((weekStart) => {
      const entry = byWeek.get(weekStart) ?? { total: 0, count: 0 };
      return {
        weekStart,
        label: `Week of ${formatNZDate(weekStart, "d MMM")}`,
        total: Math.round(entry.total * 100) / 100,
        count: entry.count,
      };
    });
}

export function getHighestSpendingDay(expenses: Expense[], range: DateRange): DaySpending | null {
  const days = groupSpendingByDay(expenses, range).filter((d) => d.count > 0);
  if (days.length === 0) return null;
  return days.reduce((highest, day) => (day.total > highest.total ? day : highest));
}

export function getHighestSpendingWeek(expenses: Expense[], range: DateRange): WeekSpending | null {
  const weeks = groupSpendingByWeek(expenses, range).filter((w) => w.count > 0);
  if (weeks.length === 0) return null;
  return weeks.reduce((highest, week) => (week.total > highest.total ? week : highest));
}

/** Average daily spend over the trailing `days` window ending today, used as the forecast's variable-spend estimate. */
export function getRecentDailyAverage(expenses: Expense[], days: number, today: Date = new Date()): number {
  const end = startOfDay(today);
  const range: DateRange = { start: subDays(end, days - 1), end };
  const recent = filterExpensesByRange(expenses, range);
  return getTotalSpent(recent) / days;
}

export function getOldestExpenseDate(expenses: Expense[]): string | null {
  if (expenses.length === 0) return null;
  return expenses.reduce((oldest, e) => (e.date < oldest ? e.date : oldest), expenses[0].date);
}
