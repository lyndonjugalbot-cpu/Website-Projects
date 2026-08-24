import { AlertTriangle, CircleCheck, Plus, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { Budgets, Expense, RecurringExpense, RecurringExpenseInput } from "../types";
import { formatNZD } from "../utils/currency";
import { formatNZDateFriendly, startOfDay, subDays, toISODateString } from "../utils/date";
import { getRecentDailyAverage, groupSpendingByCategory } from "../utils/expenses";
import { findFirstNegativeDay, projectBalance, suggestSavings } from "../utils/forecast";
import { ChartCard, ReportStat } from "./ReportPieces";
import { ForecastChart } from "./charts/ForecastChart";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { EmptyState } from "./EmptyState";
import { Modal } from "./Modal";
import { RecurringExpenseForm } from "./RecurringExpenseForm";
import { RecurringExpenseList } from "./RecurringExpenseList";

interface ForecastProps {
  expenses: Expense[];
  budgets: Budgets;
  recurringExpenses: RecurringExpense[];
  onAddRecurring: (input: RecurringExpenseInput) => void;
  onUpdateRecurring: (id: string, input: RecurringExpenseInput) => void;
  onToggleRecurringActive: (id: string, active: boolean) => void;
  onDeleteRecurring: (id: string) => void;
  onConfigureSettings: () => void;
}

const HISTORY_WINDOW_DAYS = 30;

const HORIZON_OPTIONS = [
  { label: "4 weeks", days: 28 },
  { label: "8 weeks", days: 56 },
  { label: "3 months", days: 90 },
];

export function Forecast({
  expenses,
  budgets,
  recurringExpenses,
  onAddRecurring,
  onUpdateRecurring,
  onToggleRecurringActive,
  onDeleteRecurring,
  onConfigureSettings,
}: ForecastProps) {
  const [horizonDays, setHorizonDays] = useState(HORIZON_OPTIONS[1].days);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<RecurringExpense | null>(null);

  const openAddForm = () => {
    setEditingExpense(null);
    setIsFormOpen(true);
  };
  const openEditForm = (expense: RecurringExpense) => {
    setEditingExpense(expense);
    setIsFormOpen(true);
  };
  const closeForm = () => {
    setIsFormOpen(false);
    setEditingExpense(null);
  };
  const handleSubmit = (input: RecurringExpenseInput) => {
    if (editingExpense) {
      onUpdateRecurring(editingExpense.id, input);
    } else {
      onAddRecurring(input);
    }
    closeForm();
  };

  const recentWindow = useMemo(() => {
    const end = startOfDay(new Date());
    return { start: subDays(end, HISTORY_WINDOW_DAYS - 1), end };
  }, []);
  const recentExpenses = useMemo(
    () => expenses.filter((e) => e.date >= toISODateString(recentWindow.start) && e.date <= toISODateString(recentWindow.end)),
    [expenses, recentWindow],
  );
  const historicalDailyAverage = useMemo(
    () => getRecentDailyAverage(expenses, HISTORY_WINDOW_DAYS),
    [expenses],
  );
  const categoryTotals = useMemo(() => groupSpendingByCategory(recentExpenses), [recentExpenses]);

  const hasForecastInputs = budgets.startingBalance !== null;

  const points = useMemo(() => {
    if (!hasForecastInputs) return [];
    return projectBalance({
      startingBalance: budgets.startingBalance!,
      income: budgets.income,
      recurringExpenses,
      historicalDailyAverage,
      horizonDays,
    });
  }, [hasForecastInputs, budgets.startingBalance, budgets.income, recurringExpenses, historicalDailyAverage, horizonDays]);

  const negativeDay = useMemo(() => findFirstNegativeDay(points), [points]);
  const worstBalance = points.length > 0 ? Math.min(...points.map((p) => p.balance)) : 0;
  const deficit = Math.max(0, -worstBalance);
  const suggestions = useMemo(
    () =>
      suggestSavings({
        deficit,
        categoryTotals,
        windowDays: HISTORY_WINDOW_DAYS,
        horizonDays,
      }),
    [deficit, categoryTotals, horizonDays],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Balance forecast</h2>
        <div className="flex gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
          {HORIZON_OPTIONS.map((option) => (
            <button
              key={option.days}
              type="button"
              onClick={() => setHorizonDays(option.days)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                horizonDays === option.days
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {!hasForecastInputs ? (
        <EmptyState
          icon={TrendingDown}
          title="Set up your forecast"
          description="Add your current account balance (and optionally your income) in settings so we can project your balance ahead of time."
          action={
            <button
              type="button"
              onClick={onConfigureSettings}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              Set up forecast
            </button>
          }
        />
      ) : (
        <>
          {negativeDay ? (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                On your current trend, your balance is projected to go negative around{" "}
                <span className="font-semibold">{formatNZDateFriendly(negativeDay.date)}</span>. See the suggestions
                below for ways to close the gap.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Your balance is projected to stay positive over the next {horizonDays} days.</p>
            </div>
          )}

          <ChartCard title="Projected balance">
            <ForecastChart data={points} goesNegative={negativeDay !== null} />
          </ChartCard>

          {suggestions.length > 0 && (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Ways to close the {formatNZD(deficit)} gap
              </h3>
              <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {suggestions.map((s) => (
                  <li key={s.category} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-600 dark:text-slate-300">
                      Trim <span className="font-medium text-slate-900 dark:text-slate-100">{s.category}</span>{" "}
                      <span className="text-xs text-slate-400">(~{formatNZD(s.projectedSpend)} projected)</span>
                    </span>
                    <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                      -{formatNZD(s.suggestedCut)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReportStat label="Estimated daily spend" value={formatNZD(historicalDailyAverage)} sub="based on the last 30 days" />
            <ReportStat
              label="Lowest projected balance"
              value={formatNZD(worstBalance)}
              sub={`within the next ${horizonDays} days`}
            />
          </div>
        </>
      )}

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Recurring bills</h3>
            <p className="text-xs text-slate-400">
              Projected on their due dates. If a bill is also logged as a regular expense, it may be double-counted.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddForm}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        <RecurringExpenseList
          recurringExpenses={recurringExpenses}
          onEdit={openEditForm}
          onDelete={setDeletingExpense}
          onToggleActive={(expense) => onToggleRecurringActive(expense.id, !expense.active)}
        />
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingExpense ? "Edit recurring expense" : "Add recurring expense"}
      >
        <RecurringExpenseForm initialExpense={editingExpense ?? undefined} onSubmit={handleSubmit} onCancel={closeForm} />
      </Modal>

      <ConfirmationDialog
        isOpen={deletingExpense !== null}
        title="Delete recurring expense?"
        message={
          deletingExpense
            ? `Are you sure you want to delete "${deletingExpense.description}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (deletingExpense) onDeleteRecurring(deletingExpense.id);
          setDeletingExpense(null);
        }}
        onCancel={() => setDeletingExpense(null)}
      />
    </div>
  );
}
