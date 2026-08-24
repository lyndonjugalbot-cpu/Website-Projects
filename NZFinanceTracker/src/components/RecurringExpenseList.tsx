import { Pause, Pencil, Play, Repeat, Trash2 } from "lucide-react";
import { CATEGORY_COLORS, FREQUENCY_LABELS } from "../config";
import type { RecurringExpense } from "../types";
import { formatNZD } from "../utils/currency";
import { formatNZDate } from "../utils/date";
import { EmptyState } from "./EmptyState";

interface RecurringExpenseListProps {
  recurringExpenses: RecurringExpense[];
  onEdit: (expense: RecurringExpense) => void;
  onDelete: (expense: RecurringExpense) => void;
  onToggleActive: (expense: RecurringExpense) => void;
}

export function RecurringExpenseList({ recurringExpenses, onEdit, onDelete, onToggleActive }: RecurringExpenseListProps) {
  if (recurringExpenses.length === 0) {
    return (
      <EmptyState
        icon={Repeat}
        title="No recurring bills yet"
        description="Add rent, subscriptions, or other regular bills so the forecast can project them on their due dates."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {recurringExpenses.map((expense) => (
        <li
          key={expense.id}
          className={`flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 transition hover:border-slate-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 ${
            expense.active ? "" : "opacity-60"
          }`}
        >
          <span
            className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: CATEGORY_COLORS[expense.category] }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{expense.description}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span>{FREQUENCY_LABELS[expense.frequency]}</span>
              <span aria-hidden="true">·</span>
              <span>Next due {formatNZDate(expense.nextDueDate)}</span>
              {!expense.active && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">Paused</span>
                </>
              )}
            </div>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatNZD(expense.amount)}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleActive(expense)}
              aria-label={expense.active ? `Pause ${expense.description}` : `Resume ${expense.description}`}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-ocean-600 dark:hover:bg-slate-800 dark:hover:text-ocean-400"
            >
              {expense.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => onEdit(expense)}
              aria-label={`Edit ${expense.description}`}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-ocean-600 dark:hover:bg-slate-800 dark:hover:text-ocean-400"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(expense)}
              aria-label={`Delete ${expense.description}`}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
