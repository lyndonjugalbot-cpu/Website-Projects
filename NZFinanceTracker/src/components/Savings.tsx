import { ArrowDownLeft, Plus, ShieldCheck, Wallet } from "lucide-react";
import { useMemo } from "react";
import type { Budgets, Expense, PeriodBudget, ReportView, SavingsEntry } from "../types";
import { formatNZD } from "../utils/currency";
import { buildSavingsImpactReport } from "../utils/periodBudget";
import { buildSavingsTimeline, getManualBalance, getTotalDeposited, getTotalWithdrawn } from "../utils/savings";
import { ChartCard, ReportStat } from "./ReportPieces";
import { SavingsEntryList } from "./SavingsEntryList";
import { SavingsImpactReport } from "./SavingsImpactReport";
import { SavingsHistoryChart } from "./charts/SavingsHistoryChart";

interface SavingsProps {
  savingsEntries: SavingsEntry[];
  expenses: Expense[];
  periodBudgets: PeriodBudget[];
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
  periodBudgets,
  budgets,
  view,
  onAddDeposit,
  onAddWithdrawal,
  onEditEntry,
  onDeleteEntry,
  onConfigureSettings,
}: SavingsProps) {
  const manualBalance = getManualBalance(savingsEntries);
  const deposited = getTotalDeposited(savingsEntries);
  const withdrawn = getTotalWithdrawn(savingsEntries);

  const impactReport = useMemo(
    () => buildSavingsImpactReport(periodBudgets, budgets, expenses, view),
    [periodBudgets, budgets, expenses, view],
  );
  const autoKept = impactReport.totals.keptSavings;
  const balance = Math.round((manualBalance + autoKept) * 100) / 100;

  const timeline = useMemo(
    () => buildSavingsTimeline(savingsEntries, expenses, periodBudgets, budgets, view),
    [savingsEntries, expenses, periodBudgets, budgets, view],
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

      <p className="text-xs text-slate-400">
        Use <span className="font-medium text-slate-500 dark:text-slate-400">Add to savings</span> for money you set
        aside yourself — side-hustle income, a windfall, a transfer. The{" "}
        <span className="font-medium text-slate-500 dark:text-slate-400">{formatNZD(autoKept)}</span> from automatic{" "}
        {view === "weekly" ? "weekly" : "monthly"} savings is added for you from each period's budget.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ReportStat icon={Wallet} label="Current savings balance" value={formatNZD(balance)} />
        <ReportStat label="Added by hand" value={formatNZD(deposited)} sub={withdrawn > 0 ? `${formatNZD(withdrawn)} withdrawn` : undefined} />
        <ReportStat
          icon={ShieldCheck}
          label={`From automatic ${view === "weekly" ? "weekly" : "monthly"} savings`}
          value={formatNZD(autoKept)}
          sub={`${impactReport.totals.periodsTracked} ${view === "weekly" ? "week" : "month"}s tracked`}
        />
        <ReportStat
          label="Lost to overspending"
          value={formatNZD(impactReport.totals.lostToDips)}
          sub={
            impactReport.totals.periodsDipped + impactReport.totals.periodsOverspent > 0
              ? `${impactReport.totals.periodsDipped + impactReport.totals.periodsOverspent} ${view === "weekly" ? "week" : "month"}s affected`
              : "none — nicely done"
          }
        />
      </div>

      <ChartCard title={`Savings over time (${timeline.windowLabel})`}>
        <p className="-mt-1 mb-3 text-xs text-slate-400">
          <span className="font-medium text-slate-500 dark:text-slate-400">Set aside</span> is money you've actually
          banked — by hand plus the automatic savings that survived each period's spending.{" "}
          {timeline.hasTarget ? (
            <>
              <span className="font-medium text-slate-500 dark:text-slate-400">Target</span> is where you'd be with no
              overspending.
            </>
          ) : (
            <button type="button" onClick={onConfigureSettings} className="font-medium text-brand-600 hover:underline">
              Set an automatic {view} savings amount
            </button>
          )}
          {!timeline.hasTarget && " to compare against a target."}
        </p>
        <SavingsHistoryChart data={timeline.points} showTarget={timeline.hasTarget} />
      </ChartCard>

      <ChartCard title="When spending dipped into savings">
        <SavingsImpactReport report={impactReport} />
      </ChartCard>

      <ChartCard title="Activity">
        <SavingsEntryList entries={savingsEntries} onEdit={onEditEntry} onDelete={onDeleteEntry} />
      </ChartCard>
    </div>
  );
}
