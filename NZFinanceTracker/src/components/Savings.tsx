import { ArrowDownLeft, Plus, RefreshCw, Wallet } from "lucide-react";
import { useMemo } from "react";
import type { Budgets, Expense, ReportView, SavingsEntry } from "../types";
import { formatNZD } from "../utils/currency";
import {
  buildSavingsTimeline,
  getAutoContributed,
  getSavingsBalance,
  getTotalDeposited,
  getTotalWithdrawn,
} from "../utils/savings";
import { ChartCard, ReportStat } from "./ReportPieces";
import { SavingsEntryList } from "./SavingsEntryList";
import { SavingsHistoryChart } from "./charts/SavingsHistoryChart";

interface SavingsProps {
  savingsEntries: SavingsEntry[];
  expenses: Expense[];
  budgets: Budgets;
  view: ReportView;
  onAddDeposit: () => void;
  onAddWithdrawal: () => void;
  onEditEntry: (entry: SavingsEntry) => void;
  onDeleteEntry: (entry: SavingsEntry) => void;
  onConfigureSettings: () => void;
}

export function Savings({
  savingsEntries,
  expenses,
  budgets,
  view,
  onAddDeposit,
  onAddWithdrawal,
  onEditEntry,
  onDeleteEntry,
  onConfigureSettings,
}: SavingsProps) {
  const balance = getSavingsBalance(savingsEntries);
  const deposited = getTotalDeposited(savingsEntries);
  const withdrawn = getTotalWithdrawn(savingsEntries);
  const autoContributed = getAutoContributed(savingsEntries);
  const autoCount = savingsEntries.filter((e) => e.source !== "manual").length;

  const timeline = useMemo(
    () => buildSavingsTimeline(savingsEntries, expenses, budgets, view),
    [savingsEntries, expenses, budgets, view],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Savings</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAddDeposit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add to savings
          </button>
          <button
            type="button"
            onClick={onAddWithdrawal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowDownLeft className="h-4 w-4" />
            Withdraw
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ReportStat icon={Wallet} label="Current savings balance" value={formatNZD(balance)} />
        <ReportStat label="Total added" value={formatNZD(deposited)} />
        <ReportStat label="Total withdrawn" value={formatNZD(withdrawn)} />
        <ReportStat
          icon={RefreshCw}
          label="From savings goal"
          value={formatNZD(autoContributed)}
          sub={autoCount > 0 ? `${autoCount} auto contribution${autoCount === 1 ? "" : "s"}` : "No goal set yet"}
        />
      </div>

      <ChartCard title={`Savings over time (${timeline.windowLabel})`}>
        <p className="-mt-1 mb-3 text-xs text-slate-400">
          <span className="font-medium text-slate-500 dark:text-slate-400">Recorded balance</span> is the money you've
          actually set aside.{" "}
          {timeline.hasRealized ? (
            <>
              <span className="font-medium text-slate-500 dark:text-slate-400">Budget-based savings</span> is how much of
              your {view} goal your under-spending has covered, added up.
            </>
          ) : (
            <button type="button" onClick={onConfigureSettings} className="font-medium text-brand-600 hover:underline">
              Set a {view} savings goal
            </button>
          )}
          {!timeline.hasRealized && " to compare it against your budget."}
        </p>
        <SavingsHistoryChart data={timeline.points} showRealized={timeline.hasRealized} />
      </ChartCard>

      <ChartCard title="Activity">
        <SavingsEntryList entries={savingsEntries} onEdit={onEditEntry} onDelete={onDeleteEntry} />
      </ChartCard>
    </div>
  );
}
