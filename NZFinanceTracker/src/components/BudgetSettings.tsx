import { useState } from "react";
import type { Budgets } from "../types";

interface BudgetSettingsProps {
  budgets: Budgets;
  onSave: (budgets: Budgets) => void;
  onCancel: () => void;
}

export function BudgetSettings({ budgets, onSave, onCancel }: BudgetSettingsProps) {
  const [weekly, setWeekly] = useState(budgets.weekly !== null ? String(budgets.weekly) : "");
  const [monthly, setMonthly] = useState(budgets.monthly !== null ? String(budgets.monthly) : "");

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white pl-6 pr-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
  const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parseOrNull = (raw: string) => {
      const value = Number(raw);
      return raw.trim() !== "" && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
    };
    onSave({ weekly: parseOrNull(weekly), monthly: parseOrNull(monthly) });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="weeklyBudget" className={labelClass}>
          Weekly budget (NZD)
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
          <input
            id="weeklyBudget"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={weekly}
            onChange={(e) => setWeekly(e.target.value)}
            placeholder="e.g. 250.00"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor="monthlyBudget" className={labelClass}>
          Monthly budget (NZD)
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
          <input
            id="monthlyBudget"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            placeholder="e.g. 1000.00"
            className={inputClass}
          />
        </div>
      </div>
      <p className="text-xs text-slate-400">Leave a field blank to clear that budget.</p>
      <div className="mt-1 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          Save budgets
        </button>
      </div>
    </form>
  );
}
