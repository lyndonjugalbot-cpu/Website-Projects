import { formatNZD } from "../../utils/currency";

interface SavingsProgressChartProps {
  label: string;
  goal: number;
  saved: number;
}

function getStatus(percentOfGoal: number) {
  if (percentOfGoal >= 100) {
    return { color: "#0ca30c", track: "bg-emerald-100 dark:bg-emerald-950/50", message: "Savings goal on track" };
  }
  if (percentOfGoal >= 50) {
    return { color: "#ec835a", track: "bg-amber-100 dark:bg-amber-950/50", message: "Partway to your savings goal" };
  }
  return { color: "#d03b3b", track: "bg-red-100 dark:bg-red-950/50", message: "Savings goal at risk this period" };
}

export function SavingsProgressChart({ label, goal, saved }: SavingsProgressChartProps) {
  const percentOfGoal = goal > 0 ? (saved / goal) * 100 : 0;
  const status = getStatus(percentOfGoal);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {formatNZD(saved)} <span className="font-normal text-slate-400">/ {formatNZD(goal)}</span>
        </p>
      </div>
      <div
        className={`h-3 w-full overflow-hidden rounded-full ${status.track}`}
        role="progressbar"
        aria-valuenow={Math.round(percentOfGoal)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} progress`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${Math.min(percentOfGoal, 100)}%`, backgroundColor: status.color }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium" style={{ color: status.color }}>
          {status.message}
        </span>
        <span className="text-slate-400">{Math.round(percentOfGoal)}% of goal saved</span>
      </div>
    </div>
  );
}
