import { PiggyBank } from "lucide-react";
import type { ReportView } from "../types";
import { formatNZD } from "../utils/currency";
import { computePeriodSavingsImpact } from "../utils/periodBudget";
import { EmptyState } from "./EmptyState";
import { SavingsProgressChart } from "./charts/SavingsProgressChart";

interface SavingsGoalCardProps {
  view: ReportView;
  grossBudget: number | null;
  carveOut: number | null;
  totalSpent: number;
  onConfigure: () => void;
}

export function SavingsGoalCard({ view, grossBudget, carveOut, totalSpent, onConfigure }: SavingsGoalCardProps) {
  const label = view === "weekly" ? "Automatic savings this week" : "Automatic savings this month";

  if (grossBudget === null || carveOut === null || carveOut <= 0) {
    return (
      <EmptyState
        icon={PiggyBank}
        title={`No automatic savings set`}
        description={`Set a ${view} budget and an automatic-savings amount to see how much you're actually putting aside each ${view === "weekly" ? "week" : "month"}.`}
        action={
          <button
            type="button"
            onClick={onConfigure}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Set automatic savings
          </button>
        }
      />
    );
  }

  const impact = computePeriodSavingsImpact({ grossBudget, carveOut, spent: totalSpent });

  return (
    <div className="flex flex-col gap-2">
      <SavingsProgressChart label={label} goal={impact.plannedSavings} saved={impact.keptSavings} />
      {impact.status !== "on-track" && (
        <p className="text-xs font-medium text-red-600 dark:text-red-400">
          {formatNZD(impact.shortfall)} of your {formatNZD(impact.plannedSavings)} automatic savings went to
          {impact.status === "overspent" ? " overspending" : " covering spending"} this {view === "weekly" ? "week" : "month"}.
          {impact.overspend > 0 && ` You're also ${formatNZD(impact.overspend)} over budget.`}
        </p>
      )}
    </div>
  );
}
