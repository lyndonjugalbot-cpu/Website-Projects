import { PiggyBank } from "lucide-react";
import type { Budgets, ReportView } from "../types";
import { computeRealizedSavings } from "../utils/forecast";
import { EmptyState } from "./EmptyState";
import { SavingsProgressChart } from "./charts/SavingsProgressChart";

interface SavingsGoalCardProps {
  view: ReportView;
  budgets: Budgets;
  totalSpent: number;
  onConfigure: () => void;
}

export function SavingsGoalCard({ view, budgets, totalSpent, onConfigure }: SavingsGoalCardProps) {
  const budget = view === "weekly" ? budgets.weekly : budgets.monthly;
  const goal = view === "weekly" ? budgets.savingsWeekly : budgets.savingsMonthly;
  const label = view === "weekly" ? "Weekly savings goal" : "Monthly savings goal";

  if (budget === null || goal === null) {
    return (
      <EmptyState
        icon={PiggyBank}
        title={`No ${view} savings goal set`}
        description={`Carve out a ${view} savings goal from your budget to track how much you're actually putting aside.`}
        action={
          <button
            type="button"
            onClick={onConfigure}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Set savings goal
          </button>
        }
      />
    );
  }

  const saved = computeRealizedSavings(budget, goal, totalSpent) ?? 0;

  return <SavingsProgressChart label={label} goal={goal} saved={saved} />;
}
