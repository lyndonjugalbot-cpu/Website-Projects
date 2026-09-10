import { addDays, addMonths } from "date-fns";
import type { BudgetPeriod, Budgets, Expense, PeriodBudget } from "../types";
import {
  formatNZDate,
  getEndOfMonth,
  getEndOfWeek,
  getRetentionCutoff,
  getStartOfMonth,
  getStartOfWeek,
  toISODateString,
} from "./date";
import { filterExpensesByRange } from "./expenses";
import { computeRealizedSavings } from "./forecast";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** ISO start of the week (Monday) or month containing `date`. */
export function getPeriodStartISO(period: BudgetPeriod, date: Date): string {
  return toISODateString(period === "weekly" ? getStartOfWeek(date) : getStartOfMonth(date));
}

/** Human label for a period start, e.g. "Week of 8 Sep" or "September 2026". */
export function formatPeriodLabel(period: BudgetPeriod, periodStartISO: string): string {
  return period === "weekly"
    ? `Week of ${formatNZDate(periodStartISO, "d MMM")}`
    : formatNZDate(periodStartISO, "MMMM yyyy");
}

/** The explicit per-period entry for a period, if the user has saved one. */
export function findExplicitPeriodBudget(
  periodBudgets: PeriodBudget[],
  period: BudgetPeriod,
  periodStartISO: string,
): PeriodBudget | undefined {
  return periodBudgets.find((pb) => pb.period === period && pb.periodStart === periodStartISO);
}

/** The budget in force for a period: its explicit entry, else the matching default, else null. */
export function resolveGrossBudget(
  periodBudgets: PeriodBudget[],
  budgets: Budgets,
  period: BudgetPeriod,
  periodStartISO: string,
): number | null {
  const explicit = findExplicitPeriodBudget(periodBudgets, period, periodStartISO);
  if (explicit) return explicit.amount;
  return (period === "weekly" ? budgets.weekly : budgets.monthly) ?? null;
}

export type SavingsImpactStatus = "no-budget" | "on-track" | "dipped" | "overspent";

export interface PeriodSavingsImpact {
  grossBudget: number | null;
  carveOut: number;
  /** budget − carve-out (floored at 0); the real day-to-day spending limit. Null when no budget. */
  effectiveBudget: number | null;
  /** What we set out to save this period: min(carve-out, budget). */
  plannedSavings: number;
  /** What actually stays saved after spending: clamp(budget − spent, 0, plannedSavings). */
  keptSavings: number;
  /** plannedSavings − keptSavings: how much of the auto-savings the spending ate. */
  shortfall: number;
  /** Spending beyond the whole budget — past even the savings slice. */
  overspend: number;
  status: SavingsImpactStatus;
}

/** Works out how a period's spending landed against its budget and automatic-savings slice. */
export function computePeriodSavingsImpact({
  grossBudget,
  carveOut,
  spent,
}: {
  grossBudget: number | null;
  carveOut: number | null;
  spent: number;
}): PeriodSavingsImpact {
  const carve = Math.max(0, carveOut ?? 0);

  if (grossBudget === null) {
    return {
      grossBudget: null,
      carveOut: carve,
      effectiveBudget: null,
      plannedSavings: 0,
      keptSavings: 0,
      shortfall: 0,
      overspend: 0,
      status: "no-budget",
    };
  }

  const effectiveBudget = round2(Math.max(0, grossBudget - carve));
  const plannedSavings = round2(Math.min(carve, grossBudget));
  const keptSavings = round2(computeRealizedSavings(grossBudget, plannedSavings, spent) ?? 0);
  const shortfall = round2(plannedSavings - keptSavings);
  const overspend = round2(Math.max(0, spent - grossBudget));
  const status: SavingsImpactStatus =
    overspend > 0 ? "overspent" : shortfall > 0 ? "dipped" : "on-track";

  return { grossBudget, carveOut: carve, effectiveBudget, plannedSavings, keptSavings, shortfall, overspend, status };
}

export interface SavingsImpactPeriodRow {
  periodStart: string;
  label: string;
  spent: number;
  impact: PeriodSavingsImpact;
}

export interface SavingsImpactReport {
  view: BudgetPeriod;
  /** Every past/current period in the retention window that had a budget, newest first. */
  rows: SavingsImpactPeriodRow[];
  /** Just the rows where spending dipped into or blew past the automatic savings. */
  affected: SavingsImpactPeriodRow[];
  totals: {
    plannedSavings: number;
    keptSavings: number;
    /** Σ shortfall — auto-savings lost to overspending across the window. */
    lostToDips: number;
    overspend: number;
    periodsDipped: number;
    periodsOverspent: number;
    periodsTracked: number;
  };
}

/**
 * Walks every week / month in the expense-retention window and reports how each
 * one's spending landed against its budget and automatic-savings slice. Only
 * periods you actually used the app for count — one that has an explicit budget
 * entry or at least one expense — so empty history never invents savings.
 * Follows the given view; weekly and monthly are alternative lenses on the same
 * money, never added together.
 */
export function buildSavingsImpactReport(
  periodBudgets: PeriodBudget[],
  budgets: Budgets,
  expenses: Expense[],
  view: BudgetPeriod,
  today: Date = new Date(),
): SavingsImpactReport {
  const carveOut = view === "weekly" ? budgets.savingsWeekly : budgets.savingsMonthly;
  const startOf = view === "weekly" ? getStartOfWeek : getStartOfMonth;
  const endOf = view === "weekly" ? getEndOfWeek : getEndOfMonth;
  const step = (d: Date) => (view === "weekly" ? addDays(d, 7) : addMonths(d, 1));

  const firstStart = startOf(getRetentionCutoff(today));
  const currentStart = startOf(today).getTime();

  const rows: SavingsImpactPeriodRow[] = [];
  for (let cursor = firstStart; cursor.getTime() <= currentStart; cursor = step(cursor)) {
    const periodStartISO = toISODateString(cursor);
    const grossBudget = resolveGrossBudget(periodBudgets, budgets, view, periodStartISO);
    if (grossBudget === null) continue;
    const inPeriod = filterExpensesByRange(expenses, { start: cursor, end: endOf(cursor) });
    const isExplicit = findExplicitPeriodBudget(periodBudgets, view, periodStartISO) !== undefined;
    if (!isExplicit && inPeriod.length === 0) continue;
    const spent = round2(inPeriod.reduce((sum, e) => sum + e.amount, 0));
    rows.push({
      periodStart: periodStartISO,
      label: formatPeriodLabel(view, periodStartISO),
      spent,
      impact: computePeriodSavingsImpact({ grossBudget, carveOut, spent }),
    });
  }
  rows.reverse();

  const affected = rows.filter(
    (row) => row.impact.status === "dipped" || row.impact.status === "overspent",
  );
  const totals = rows.reduce(
    (acc, row) => {
      acc.plannedSavings = round2(acc.plannedSavings + row.impact.plannedSavings);
      acc.keptSavings = round2(acc.keptSavings + row.impact.keptSavings);
      acc.lostToDips = round2(acc.lostToDips + row.impact.shortfall);
      acc.overspend = round2(acc.overspend + row.impact.overspend);
      if (row.impact.status === "dipped") acc.periodsDipped += 1;
      if (row.impact.status === "overspent") acc.periodsOverspent += 1;
      acc.periodsTracked += 1;
      return acc;
    },
    {
      plannedSavings: 0,
      keptSavings: 0,
      lostToDips: 0,
      overspend: 0,
      periodsDipped: 0,
      periodsOverspent: 0,
      periodsTracked: 0,
    },
  );

  return { view, rows, affected, totals };
}
