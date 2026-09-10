import { CalendarCheck, ShoppingBag } from "lucide-react";
import type { DateRange, Expense } from "../types";
import { formatNZD } from "../utils/currency";
import { getHighestSpendingDay, getLargestPurchase, groupSpendingByCategory, groupSpendingByDay } from "../utils/expenses";
import { CategoryDonutChart } from "./charts/CategoryDonutChart";
import { SpendingTrendChart } from "./charts/SpendingTrendChart";
import { PeriodSavingsSummary } from "./PeriodSavingsSummary";
import { ChartCard, ReportStat } from "./ReportPieces";

interface WeeklyReportProps {
  expenses: Expense[];
  range: DateRange;
  grossBudget: number | null;
  carveOut: number | null;
}

export function WeeklyReport({ expenses, range, grossBudget, carveOut }: WeeklyReportProps) {
  const dayTotals = groupSpendingByDay(expenses, range);
  const categoryTotals = groupSpendingByCategory(expenses);
  const highestDay = getHighestSpendingDay(expenses, range);
  const largest = getLargestPurchase(expenses);
  const totalWeekly = dayTotals.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="flex flex-col gap-5">
      <PeriodSavingsSummary view="weekly" grossBudget={grossBudget} carveOut={carveOut} spent={totalWeekly} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ReportStat label="Total weekly spending" value={formatNZD(totalWeekly)} />
        <ReportStat
          icon={CalendarCheck}
          label="Highest-spending day"
          value={highestDay ? formatNZD(highestDay.total) : "—"}
          sub={highestDay?.label}
        />
        <ReportStat
          icon={ShoppingBag}
          label="Largest individual purchase"
          value={largest ? formatNZD(largest.amount) : "—"}
          sub={largest?.description}
        />
      </div>

      <ChartCard title="Daily spending (Mon–Sun)">
        <SpendingTrendChart data={dayTotals.map((d) => ({ label: d.label, total: d.total }))} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="Spending by category">
          <CategoryDonutChart totals={categoryTotals} />
        </ChartCard>
        <ChartCard title="Expenses per day">
          <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {dayTotals.map((day) => (
              <li key={day.date} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-600 dark:text-slate-300">{day.label}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">
                    {day.count} expense{day.count === 1 ? "" : "s"}
                  </span>
                  <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                    {formatNZD(day.total)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
    </div>
  );
}
