import { PiggyBank } from "lucide-react";
import type { Budgets, ReportView } from "../types";
import { BudgetProgressChart } from "./charts/BudgetProgressChart";
import { EmptyState } from "./EmptyState";

interface BudgetCardProps {
  view: ReportView;
  budgets: Budgets;
  totalSpent: number;
  onConfigure: () => void;
}

export function BudgetCard({ view, budgets, totalSpent, onConfigure }: BudgetCardProps) {
  const budget = view === "weekly" ? budgets.weekly : budgets.monthly;
  const label = view === "weekly" ? "Weekly budget" : "Monthly budget";

  if (budget === null) {
    return (
      <EmptyState
        icon={PiggyBank}
        title={`No ${view} budget set`}
        description={`Set a ${view} budget to track your spending against it for the selected period.`}
        action={
          <button
            type="button"
            onClick={onConfigure}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Set budget
          </button>
        }
      />
    );
  }

  return <BudgetProgressChart label={label} budget={budget} spent={totalSpent} />;
}
