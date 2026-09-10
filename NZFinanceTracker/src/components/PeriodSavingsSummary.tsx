import { PiggyBank, ShieldCheck, TriangleAlert } from "lucide-react";
import type { ReportView } from "../types";
import { formatNZD } from "../utils/currency";
import { computePeriodSavingsImpact } from "../utils/periodBudget";

interface PeriodSavingsSummaryProps {
  view: ReportView;
  grossBudget: number | null;
  carveOut: number | null;
  spent: number;
}

/** One-line status of the selected period's spending against its budget and automatic savings. */
export function PeriodSavingsSummary({ view, grossBudget, carveOut, spent }: PeriodSavingsSummaryProps) {
  if (grossBudget === null) return null;

  const impact = computePeriodSavingsImpact({ grossBudget, carveOut, spent });
  const periodWord = view === "weekly" ? "week" : "month";

  const tone =
    impact.status === "overspent"
      ? "border-red-100 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
      : impact.status === "dipped"
        ? "border-amber-100 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
        : "border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200";
  const Icon = impact.status === "on-track" ? ShieldCheck : impact.status === "dipped" ? PiggyBank : TriangleAlert;

  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-2.5 text-sm ${tone}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Budget {formatNZD(impact.grossBudget ?? 0)} · spent {formatNZD(spent)} ·{" "}
        {impact.plannedSavings > 0 ? (
          <>
            automatic savings kept{" "}
            <span className="font-semibold">
              {formatNZD(impact.keptSavings)} / {formatNZD(impact.plannedSavings)}
            </span>
            {impact.status === "dipped" && ` — ${formatNZD(impact.shortfall)} went to spending this ${periodWord}.`}
            {impact.status === "overspent" &&
              ` — savings wiped out and ${formatNZD(impact.overspend)} over budget this ${periodWord}.`}
            {impact.status === "on-track" && ` — safe this ${periodWord}.`}
          </>
        ) : (
          <>{formatNZD(Math.max(0, (impact.grossBudget ?? 0) - spent))} left this {periodWord}.</>
        )}
      </p>
    </div>
  );
}
