import { Plus } from "lucide-react";
import type { Expense } from "../types";
import { SummaryCards } from "./SummaryCards";

interface DashboardProps {
  expenses: Expense[];
  budgetAmount: number | null;
  onAddExpense: () => void;
}

export function Dashboard({ expenses, budgetAmount, onAddExpense }: DashboardProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Overview</h2>
        <button
          type="button"
          onClick={onAddExpense}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Add Expense
        </button>
      </div>
      <SummaryCards expenses={expenses} budgetAmount={budgetAmount} />
    </div>
  );
}
