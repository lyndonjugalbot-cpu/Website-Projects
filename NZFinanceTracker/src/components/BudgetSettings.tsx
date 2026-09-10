import { useState } from "react";
import { FREQUENCIES, FREQUENCY_LABELS } from "../config";
import type { Budgets, Frequency } from "../types";
import { toISODateString } from "../utils/date";

interface BudgetSettingsProps {
  budgets: Budgets;
  onSave: (budgets: Budgets) => void;
  onCancel: () => void;
}

function parseOrNull(raw: string): number | null {
  const value = Number(raw);
  return raw.trim() !== "" && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

export function BudgetSettings({ budgets, onSave, onCancel }: BudgetSettingsProps) {
  const [weekly, setWeekly] = useState(budgets.weekly !== null ? String(budgets.weekly) : "");
  const [monthly, setMonthly] = useState(budgets.monthly !== null ? String(budgets.monthly) : "");
  const [savingsWeekly, setSavingsWeekly] = useState(
    budgets.savingsWeekly !== null ? String(budgets.savingsWeekly) : "",
  );
  const [savingsMonthly, setSavingsMonthly] = useState(
    budgets.savingsMonthly !== null ? String(budgets.savingsMonthly) : "",
  );
  const [startingBalance, setStartingBalance] = useState(
    budgets.startingBalance !== null ? String(budgets.startingBalance) : "",
  );
  const [incomeAmount, setIncomeAmount] = useState(budgets.income ? String(budgets.income.amount) : "");
  const [incomeFrequency, setIncomeFrequency] = useState<Frequency>(budgets.income?.frequency ?? "weekly");
  const [nextPayDate, setNextPayDate] = useState(budgets.income?.nextPayDate ?? toISODateString(new Date()));

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white pl-6 pr-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-50";
  const plainInputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
  const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";
  const sectionTitleClass = "text-xs font-semibold uppercase tracking-wide text-slate-400";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const parsedWeeklyBudget = parseOrNull(weekly);
    const parsedMonthlyBudget = parseOrNull(monthly);
    // Automatic savings is a fixed slice carved out of whatever budget you enter for a period;
    // it stands on its own, independent of the default budgets above.
    const parsedSavingsWeekly = parseOrNull(savingsWeekly);
    const parsedSavingsMonthly = parseOrNull(savingsMonthly);

    const parsedIncomeAmount = parseOrNull(incomeAmount);

    onSave({
      weekly: parsedWeeklyBudget,
      monthly: parsedMonthlyBudget,
      savingsWeekly: parsedSavingsWeekly,
      savingsMonthly: parsedSavingsMonthly,
      startingBalance: parseOrNull(startingBalance),
      income: parsedIncomeAmount === null ? null : { amount: parsedIncomeAmount, frequency: incomeFrequency, nextPayDate },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <p className={sectionTitleClass}>Default budgets</p>
        <p className="-mt-2 text-xs text-slate-400">
          These prefill each period on the Budget tab — change any single week or month there without touching the default.
        </p>
        <div>
          <label htmlFor="weeklyBudget" className={labelClass}>
            Default weekly budget (NZD)
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
            Default monthly budget (NZD)
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
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className={sectionTitleClass}>Automatic savings</p>
        <p className="-mt-2 text-xs text-slate-400">
          A fixed slice moved to savings from whatever budget you enter for a period. Your effective spending limit
          becomes budget minus this. If spending runs past that limit, the shortfall comes out of that period's
          automatic savings and is flagged on the Savings tab.
        </p>
        <div>
          <label htmlFor="savingsWeekly" className={labelClass}>
            Automatic savings per week (NZD)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
            <input
              id="savingsWeekly"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={savingsWeekly}
              onChange={(e) => setSavingsWeekly(e.target.value)}
              placeholder="e.g. 150.00"
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label htmlFor="savingsMonthly" className={labelClass}>
            Automatic savings per month (NZD)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
            <input
              id="savingsMonthly"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={savingsMonthly}
              onChange={(e) => setSavingsMonthly(e.target.value)}
              placeholder="e.g. 600.00"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className={sectionTitleClass}>Income &amp; starting balance</p>
        <p className="-mt-2 text-xs text-slate-400">Used to forecast your balance ahead of time and flag if it's on track to go negative.</p>
        <div>
          <label htmlFor="startingBalance" className={labelClass}>
            Current account balance (NZD)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
            <input
              id="startingBalance"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              placeholder="e.g. 1500.00"
              className={inputClass}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="incomeAmount" className={labelClass}>
              Income amount (NZD)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input
                id="incomeAmount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={incomeAmount}
                onChange={(e) => setIncomeAmount(e.target.value)}
                placeholder="e.g. 1200.00"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="incomeFrequency" className={labelClass}>
              Frequency
            </label>
            <select
              id="incomeFrequency"
              value={incomeFrequency}
              onChange={(e) => setIncomeFrequency(e.target.value as Frequency)}
              className={plainInputClass}
            >
              {FREQUENCIES.map((freq) => (
                <option key={freq} value={freq}>
                  {FREQUENCY_LABELS[freq]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="nextPayDate" className={labelClass}>
            Next pay date
          </label>
          <input
            id="nextPayDate"
            type="date"
            value={nextPayDate}
            onChange={(e) => setNextPayDate(e.target.value)}
            className={plainInputClass}
          />
        </div>
      </div>

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
          Save settings
        </button>
      </div>
    </form>
  );
}
