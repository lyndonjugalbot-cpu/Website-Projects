import { Check } from "lucide-react";
import { useState } from "react";
import type { BudgetPeriod } from "../types";
import { formatNZD, parseAmountInput } from "../utils/currency";
import { formatPeriodLabel } from "../utils/periodBudget";

interface PeriodBudgetInputProps {
  period: BudgetPeriod;
  periodStartISO: string;
  /** Budget currently in force for this period (explicit entry or default). Null when neither is set. */
  resolvedAmount: number | null;
  /** True when this exact period has its own saved entry (vs. falling back to the default). */
  isExplicit: boolean;
  carveOut: number | null;
  onSave: (amount: number) => void;
  onClear: () => void;
}

export function PeriodBudgetInput({
  period,
  periodStartISO,
  resolvedAmount,
  isExplicit,
  carveOut,
  onSave,
  onClear,
}: PeriodBudgetInputProps) {
  // Mounted fresh per period via a `key` on the parent, so initialising from the prop is enough.
  const [value, setValue] = useState(resolvedAmount !== null ? String(resolvedAmount) : "");

  const parsed = parseAmountInput(value);
  const carve = carveOut && carveOut > 0 ? carveOut : 0;
  const previewEffective = parsed !== null && parsed > 0 ? Math.max(0, parsed - carve) : null;
  const dirty = (parsed ?? 0) > 0 && parsed !== resolvedAmount;

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white pl-6 pr-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (parsed !== null && parsed > 0) onSave(parsed);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-baseline justify-between">
        <label htmlFor="periodBudget" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Budget for {formatPeriodLabel(period, periodStartISO)}
        </label>
        {isExplicit ? (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Reset to default
          </button>
        ) : (
          resolvedAmount !== null && <span className="text-xs text-slate-400">using your default</span>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
          <input
            id="periodBudget"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={period === "weekly" ? "e.g. 950.00" : "e.g. 4000.00"}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={!dirty}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
          Save
        </button>
      </div>
      <p className="text-xs text-slate-400">
        {carve > 0 ? (
          previewEffective !== null ? (
            <>
              Spendable {formatNZD(previewEffective)} · {formatNZD(carve)} moves to savings automatically
            </>
          ) : (
            <>{formatNZD(carve)} of each {period === "weekly" ? "week's" : "month's"} budget moves to savings automatically</>
          )
        ) : (
          <>Set an automatic-savings amount in Budget settings to carve savings out of this budget.</>
        )}
      </p>
    </form>
  );
}
