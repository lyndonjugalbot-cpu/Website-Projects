import { formatNZD } from "../../utils/currency";

interface BudgetProgressChartProps {
  label: string;
  budget: number;
  spent: number;
}

function getStatus(percentUsed: number) {
  if (percentUsed > 100) {
    return {
      color: "#d03b3b",
      track: "bg-red-100 dark:bg-red-950/50",
      message: "You have exceeded your budget",
    };
  }
  if (percentUsed >= 70) {
    return {
      color: "#ec835a",
      track: "bg-amber-100 dark:bg-amber-950/50",
      message: "You are approaching your budget",
    };
  }
  return {
    color: "#0ca30c",
    track: "bg-emerald-100 dark:bg-emerald-950/50",
    message: "You are on track with your budget",
  };
}

export function BudgetProgressChart({ label, budget, spent }: BudgetProgressChartProps) {
  const percentUsed = budget > 0 ? (spent / budget) * 100 : 0;
  const status = getStatus(percentUsed);
  const remaining = budget - spent;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {formatNZD(spent)} <span className="font-normal text-slate-400">/ {formatNZD(budget)}</span>
        </p>
      </div>
      <div
        className={`h-3 w-full overflow-hidden rounded-full ${status.track}`}
        role="progressbar"
        aria-valuenow={Math.round(percentUsed)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} usage`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${Math.min(percentUsed, 100)}%`, backgroundColor: status.color }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium" style={{ color: status.color }}>
          {status.message}
        </span>
        <span className="text-slate-400">
          {Math.round(percentUsed)}% used · {remaining >= 0 ? `${formatNZD(remaining)} left` : `${formatNZD(Math.abs(remaining))} over`}
        </span>
      </div>
    </div>
  );
}
