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

export type Frequency = "weekly" | "fortnightly" | "monthly";

export interface Income {
  amount: number;
  frequency: Frequency;
  /** ISO date string of the next pay day, used as the projection anchor. */
  nextPayDate: string;
}

/** Per-user budget, savings-goal, and forecast-input settings (backed by the `budgets` table). */
export interface Budgets {
  weekly: number | null;
  monthly: number | null;
  /** Savings carved out of the corresponding budget; see forecast.ts for the realized-savings formula. */
  savingsWeekly: number | null;
  savingsMonthly: number | null;
  startingBalance: number | null;
  income: Income | null;
}

export type SavingsSource = "manual" | "auto-weekly" | "auto-monthly";

/** One movement in or out of savings (backed by the `savingsEntries` table). */
export interface SavingsEntry {
  id: string;
  /** Positive = money added to savings, negative = money withdrawn. */
  amount: number;
  /** ISO date string, e.g. "2026-08-19" */
  date: string;
  note: string;
  source: SavingsSource;
  createdAt: string;
}

export type SavingsEntryInput = Omit<SavingsEntry, "id" | "source" | "createdAt">;

export interface RecurringExpense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  frequency: Frequency;
  /** ISO date string; may be in the past if untouched for a while, forecast.ts rolls it forward. */
  nextDueDate: string;
  active: boolean;
}

export type RecurringExpenseInput = Omit<RecurringExpense, "id" | "active">;

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

export type NoteType = "text" | "checklist";

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export type TranscriptionStatus = "none" | "pending" | "done" | "failed";

export interface Note {
  id: string;
  type: NoteType;
  title: string;
  body: string;
  checklistItems: ChecklistItem[];
  color: string;
  audioUrl: string | null;
  transcript: string | null;
  transcriptionStatus: TranscriptionStatus;
  /** ISO date string; the day this note is scheduled onto in the calendar view. */
  scheduledDate: string | null;
  /** "HH:mm"; time of day for the reminder, if any. */
  scheduledTime: string | null;
  reminderEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NoteInput = Omit<Note, "id" | "audioUrl" | "transcript" | "transcriptionStatus" | "createdAt" | "updatedAt">;
