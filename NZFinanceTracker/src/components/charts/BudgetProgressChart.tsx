import { formatNZD } from "../../utils/currency";

interface BudgetProgressChartProps {
  label: string;
  /** The bar is measured against this — the effective (spendable) budget. */
  budget: number;
  spent: number;
  /**
   * The full budget before the automatic-savings slice. When set and spending passes `budget`,
   * the overflow is shown eating into the savings slice (amber) and then past it (red).
   */
  hardCap?: number;
  /** Size of the automatic-savings slice, for the status copy. */
  carveOut?: number;
}

function getStatus(spent: number, budget: number, hardCap: number) {
  if (spent > hardCap) {
    return { color: "#d03b3b", track: "bg-red-100 dark:bg-red-950/50", message: "Over budget — automatic savings wiped out" };
  }
  if (spent > budget) {
    return { color: "#ec835a", track: "bg-amber-100 dark:bg-amber-950/50", message: "Dipping into your automatic savings" };
  }
  if (budget > 0 && spent / budget >= 0.7) {
    return { color: "#ec835a", track: "bg-amber-100 dark:bg-amber-950/50", message: "Approaching your spendable budget" };
  }
  return { color: "#0ca30c", track: "bg-emerald-100 dark:bg-emerald-950/50", message: "On track — automatic savings safe" };
}

export function BudgetProgressChart({ label, budget, spent, hardCap, carveOut }: BudgetProgressChartProps) {
  const cap = hardCap ?? budget;
  const status = getStatus(spent, budget, cap);
  const remaining = budget - spent;

  // Bar segments as % of the full budget (cap), so the savings slice is visible on the track.
  const denom = cap > 0 ? cap : 1;
  const safePct = Math.max(0, Math.min(spent, budget)) / denom * 100;
  const intoSavingsPct = Math.max(0, Math.min(spent, cap) - budget) / denom * 100;
  const overPct = Math.max(0, spent - cap) / denom * 100;
  const carveLabel = carveOut && carveOut > 0 ? formatNZD(carveOut) : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {formatNZD(spent)} <span className="font-normal text-slate-400">/ {formatNZD(budget)}</span>
        </p>
      </div>
      <div
        className={`flex h-3 w-full overflow-hidden rounded-full ${status.track}`}
        role="progressbar"
        aria-valuenow={Math.round(budget > 0 ? (spent / budget) * 100 : 0)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} usage`}
      >
        <div className="h-full transition-[width] duration-500 ease-out" style={{ width: `${safePct}%`, backgroundColor: "#0ca30c" }} />
        <div className="h-full transition-[width] duration-500 ease-out" style={{ width: `${intoSavingsPct}%`, backgroundColor: "#ec835a" }} />
        <div className="h-full transition-[width] duration-500 ease-out" style={{ width: `${overPct}%`, backgroundColor: "#d03b3b" }} />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium" style={{ color: status.color }}>
          {status.message}
        </span>
        <span className="text-slate-400">
          {remaining >= 0
            ? `${formatNZD(remaining)} left to spend`
            : `${formatNZD(Math.abs(remaining))} into savings`}
          {carveLabel ? ` · ${carveLabel} auto-saved` : ""}
        </span>
      </div>
    </div>
  );
}
