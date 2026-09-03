import { useState } from "react";
import type { SavingsEntry, SavingsEntryInput } from "../types";
import { parseAmountInput } from "../utils/currency";
import { toISODateString } from "../utils/date";

type Direction = "deposit" | "withdrawal";

interface SavingsFormProps {
  initialEntry?: SavingsEntry;
  defaultDirection?: Direction;
  onSubmit: (input: SavingsEntryInput) => void;
  onCancel: () => void;
}

interface FormErrors {
  amount?: string;
  date?: string;
}

export function SavingsForm({ initialEntry, defaultDirection = "deposit", onSubmit, onCancel }: SavingsFormProps) {
  const maxDate = toISODateString(new Date());

  const [direction, setDirection] = useState<Direction>(
    initialEntry ? (initialEntry.amount < 0 ? "withdrawal" : "deposit") : defaultDirection,
  );
  const [amount, setAmount] = useState(initialEntry ? String(Math.abs(initialEntry.amount)) : "");
  const [date, setDate] = useState(initialEntry?.date ?? maxDate);
  const [note, setNote] = useState(initialEntry?.note ?? "");
  const [errors, setErrors] = useState<FormErrors>({});

  const isAuto = initialEntry !== undefined && initialEntry.source !== "manual";

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};
    const parsed = parseAmountInput(amount);
    if (parsed === null || parsed <= 0) {
      nextErrors.amount = "Enter an amount greater than $0.00.";
    }
    if (!date) {
      nextErrors.date = "Please select a date.";
    } else if (date > maxDate) {
      nextErrors.date = "Date cannot be in the future.";
    }
    return nextErrors;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const magnitude = parseAmountInput(amount)!;
    onSubmit({
      amount: direction === "withdrawal" ? -magnitude : magnitude,
      date,
      note: note.trim(),
    });
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";
  const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";
  const errorClass = "mt-1 text-xs font-medium text-red-600 dark:text-red-400";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <span className={labelClass}>Type</span>
        <div className="grid grid-cols-2 gap-2">
          {(["deposit", "withdrawal"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDirection(option)}
              aria-pressed={direction === option}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                direction === option
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/10 dark:text-brand-300"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {option === "deposit" ? "Add to savings" : "Withdraw"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="savingsAmount" className={labelClass}>
            Amount (NZD)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
            <input
              id="savingsAmount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`${inputClass} pl-6`}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? "savings-amount-error" : undefined}
            />
          </div>
          {errors.amount && (
            <p id="savings-amount-error" className={errorClass}>
              {errors.amount}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="savingsDate" className={labelClass}>
            Date
          </label>
          <input
            id="savingsDate"
            type="date"
            value={date}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(errors.date)}
            aria-describedby={errors.date ? "savings-date-error" : undefined}
          />
          {errors.date && (
            <p id="savings-date-error" className={errorClass}>
              {errors.date}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="savingsNote" className={labelClass}>
          Note <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="savingsNote"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={direction === "deposit" ? "e.g. Side hustle - weekend gig" : "e.g. Covered car repair"}
          className={inputClass}
        />
        {isAuto && (
          <p className="mt-1 text-xs text-slate-400">
            This entry was added automatically from your savings goal. Editing it won't stop future auto contributions.
          </p>
        )}
      </div>

      <div className="mt-1 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          {initialEntry ? "Save changes" : direction === "deposit" ? "Add to savings" : "Record withdrawal"}
        </button>
      </div>
    </form>
  );
}
