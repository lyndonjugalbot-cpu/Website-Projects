import { PiggyBank } from "lucide-react";
import type { ReportView } from "../types";
import { BudgetProgressChart } from "./charts/BudgetProgressChart";
import { EmptyState } from "./EmptyState";

interface BudgetCardProps {
  view: ReportView;
  /** Budget entered (or defaulted) for the selected period. */
  grossBudget: number | null;
  /** Automatic-savings slice carved out of it. */
  carveOut: number | null;
  totalSpent: number;
  onConfigure: () => void;
}

export function BudgetCard({ view, grossBudget, carveOut, totalSpent, onConfigure }: BudgetCardProps) {
  if (grossBudget === null) {
    return (
      <EmptyState
        icon={PiggyBank}
        title={`No ${view} budget set`}
        description={`Enter this ${view === "weekly" ? "week's" : "month's"} budget above to track your spending against it.`}
        action={
          <button
            type="button"
            onClick={onConfigure}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Set a default budget
          </button>
        }
      />
    );
  }

  const carve = carveOut && carveOut > 0 ? Math.min(carveOut, grossBudget) : 0;
  const effectiveBudget = Math.max(0, grossBudget - carve);

  return (
    <BudgetProgressChart
      label={view === "weekly" ? "Spendable this week" : "Spendable this month"}
      budget={effectiveBudget}
      hardCap={grossBudget}
      carveOut={carve}
      spent={totalSpent}
    />
  );
}
