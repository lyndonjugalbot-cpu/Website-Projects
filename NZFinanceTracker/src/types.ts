import type { ExpenseCategory } from "./config";

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  /** ISO date string, e.g. "2026-08-19" */
  date: string;
  notes: string;
  createdAt: string;
  isSample?: boolean;
}

export type ExpenseInput = Omit<Expense, "id" | "createdAt">;

export interface Budgets {
  weekly: number | null;
  monthly: number | null;
}

export type ReportView = "weekly" | "monthly";

export type QuickRangeOption =
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "custom";

export interface DateRange {
  start: Date;
  end: Date;
}

export type SortOption = "newest" | "oldest" | "highest" | "lowest";
