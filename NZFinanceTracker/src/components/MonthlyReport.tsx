import { CalendarRange, ShoppingBag } from "lucide-react";
import type { DateRange, Expense } from "../types";
import { formatNZD } from "../utils/currency";
import { getHighestSpendingWeek, getLargestPurchase, groupSpendingByCategory, groupSpendingByWeek } from "../utils/expenses";
import type { WeekSpending } from "../utils/expenses";
import { CategoryDonutChart } from "./charts/CategoryDonutChart";
import { SpendingTrendChart } from "./charts/SpendingTrendChart";
import { PeriodSavingsSummary } from "./PeriodSavingsSummary";
import { ChartCard, ReportStat } from "./ReportPieces";

interface MonthlyReportProps {
  expenses: Expense[];
  range: DateRange;
  grossBudget: number | null;
  carveOut: number | null;
}

export function MonthlyReport({ expenses, range, grossBudget, carveOut }: MonthlyReportProps) {
  const weekTotals = groupSpendingByWeek(expenses, range);
  const categoryTotals = groupSpendingByCategory(expenses);
  const highestWeek = getHighestSpendingWeek(expenses, range);
  const largest = getLargestPurchase(expenses);
  const totalMonthly = weekTotals.reduce((sum, w) => sum + w.total, 0);

  return (
    <div className="flex flex-col gap-5">
      <PeriodSavingsSummary view="monthly" grossBudget={grossBudget} carveOut={carveOut} spent={totalMonthly} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ReportStat label="Total monthly spending" value={formatNZD(totalMonthly)} />
        <ReportStat
          icon={CalendarRange}
          label="Highest-spending week"
          value={highestWeek ? formatNZD(highestWeek.total) : "—"}
          sub={highestWeek?.label}
        />
        <ReportStat
          icon={ShoppingBag}
          label="Largest individual purchase"
          value={largest ? formatNZD(largest.amount) : "—"}
          sub={largest?.description}
        />
      </div>

      <ChartCard title="Weekly spending trend">
        <SpendingTrendChart data={weekTotals.map((w) => ({ label: w.label, total: w.total }))} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="Spending by category">
          <CategoryDonutChart totals={categoryTotals} />
        </ChartCard>
        <ChartCard title="Weekly breakdown">
          <WeeklyBreakdownList weeks={weekTotals} />
        </ChartCard>
      </div>
    </div>
  );
}

function WeeklyBreakdownList({ weeks }: { weeks: WeekSpending[] }) {
  return (
    <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
      {weeks.map((week) => (
        <li key={week.weekStart} className="flex items-center justify-between py-2 text-sm">
          <span className="text-slate-600 dark:text-slate-300">{week.label}</span>
          <span className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {week.count} expense{week.count === 1 ? "" : "s"}
            </span>
            <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">{formatNZD(week.total)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
