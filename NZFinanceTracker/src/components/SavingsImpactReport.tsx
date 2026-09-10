import { ShieldCheck, TriangleAlert } from "lucide-react";
import { formatNZD } from "../utils/currency";
import type { SavingsImpactReport as Report } from "../utils/periodBudget";
import { ReportStat } from "./ReportPieces";

interface SavingsImpactReportProps {
  report: Report;
}

export function SavingsImpactReport({ report }: SavingsImpactReportProps) {
  const { totals, affected, view } = report;
  const periodWord = view === "weekly" ? "week" : "month";
  const affectedCount = totals.periodsDipped + totals.periodsOverspent;

  if (totals.periodsTracked === 0) {
    return (
      <p className="py-4 text-sm text-slate-400">
        Enter a {periodWord}ly budget with an automatic-savings amount to see whether your spending ever eats into it.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ReportStat label="Automatic savings planned" value={formatNZD(totals.plannedSavings)} sub={`${totals.periodsTracked} ${periodWord}s`} />
        <ReportStat icon={ShieldCheck} label="Actually kept" value={formatNZD(totals.keptSavings)} />
        <ReportStat icon={TriangleAlert} label="Lost to overspending" value={formatNZD(totals.lostToDips)} />
        <ReportStat
          label={`${periodWord[0].toUpperCase()}${periodWord.slice(1)}s that dipped in`}
          value={`${affectedCount} of ${totals.periodsTracked}`}
          sub={totals.periodsOverspent > 0 ? `${totals.periodsOverspent} fully over budget` : undefined}
        />
      </div>

      {affected.length === 0 ? (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          Your spending hasn't touched your automatic savings in this window. Nice.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          {affected.map((row) => (
            <li key={row.periodStart} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-700 dark:text-slate-200">{row.label}</p>
                <p className="text-xs text-slate-400">
                  Spent {formatNZD(row.spent)} of {formatNZD(row.impact.grossBudget ?? 0)} budget
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  Kept {formatNZD(row.impact.keptSavings)}{" "}
                  <span className="font-normal text-slate-400">/ {formatNZD(row.impact.plannedSavings)}</span>
                </p>
                <p className={`text-xs font-medium ${row.impact.status === "overspent" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {row.impact.status === "overspent"
                    ? `Over budget by ${formatNZD(row.impact.overspend)}`
                    : `Dipped ${formatNZD(row.impact.shortfall)} into savings`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
