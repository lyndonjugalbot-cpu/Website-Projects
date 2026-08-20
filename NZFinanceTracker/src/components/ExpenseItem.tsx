import { Pencil, Sparkles, Trash2 } from "lucide-react";
import { CATEGORY_COLORS } from "../config";
import type { Expense } from "../types";
import { formatNZD } from "../utils/currency";
import { formatNZDate } from "../utils/date";

interface ExpenseItemProps {
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

export function ExpenseItem({ expense, onEdit, onDelete }: ExpenseItemProps) {
  const color = CATEGORY_COLORS[expense.category];

  return (
    <li className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 transition hover:border-slate-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <span
        className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{expense.description}</p>
          {expense.isSample && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ocean-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ocean-700 dark:bg-ocean-900/40 dark:text-ocean-300">
              <Sparkles className="h-2.5 w-2.5" /> Sample
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
          <span>{expense.category}</span>
          <span aria-hidden="true">·</span>
          <span>{formatNZDate(expense.date)}</span>
          {expense.notes && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate italic">{expense.notes}</span>
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
  );
}
