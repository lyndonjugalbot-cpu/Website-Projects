import { useState } from "react";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "../config";
import type { Expense, ExpenseInput } from "../types";
import { parseAmountInput } from "../utils/currency";
import { fromISODateString, getRetentionCutoff, toISODateString } from "../utils/date";

interface ExpenseFormProps {
  initialExpense?: Expense;
  onSubmit: (input: ExpenseInput) => void;
  onCancel: () => void;
}

interface FormErrors {
  description?: string;
  amount?: string;
  date?: string;
}

export function ExpenseForm({ initialExpense, onSubmit, onCancel }: ExpenseFormProps) {
  const today = new Date();
  const minDate = toISODateString(getRetentionCutoff(today));
  const maxDate = toISODateString(today);

  const [description, setDescription] = useState(initialExpense?.description ?? "");
  const [amount, setAmount] = useState(initialExpense ? String(initialExpense.amount) : "");
  const [category, setCategory] = useState<ExpenseCategory>(initialExpense?.category ?? "Groceries");
  const [date, setDate] = useState(initialExpense?.date ?? maxDate);
  const [notes, setNotes] = useState(initialExpense?.notes ?? "");
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (!description.trim()) {
      nextErrors.description = "Please enter a description.";
    }
    const parsedAmount = parseAmountInput(amount);
    if (parsedAmount === null || parsedAmount <= 0) {
      nextErrors.amount = "Enter an amount greater than $0.00.";
    }
    if (!date) {
      nextErrors.date = "Please select a date.";
    } else if (date < minDate) {
      nextErrors.date = "Date cannot be more than three months old.";
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

    const parsedAmount = parseAmountInput(amount)!;
    onSubmit({
      description: description.trim(),
      amount: parsedAmount,
      category,
      date,
      notes: notes.trim(),
    });
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";
  const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";
  const errorClass = "mt-1 text-xs font-medium text-red-600 dark:text-red-400";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Weekly groceries"
          className={inputClass}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? "description-error" : undefined}
        />
        {errors.description && (
          <p id="description-error" className={errorClass}>
            {errors.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="amount" className={labelClass}>
            Amount (NZD)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`${inputClass} pl-6`}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? "amount-error" : undefined}
            />
          </div>
          {errors.amount && (
            <p id="amount-error" className={errorClass}>
              {errors.amount}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="category" className={labelClass}>
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className={inputClass}
          >
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="date" className={labelClass}>
          Date
        </label>
        <input
          id="date"
          type="date"
          value={date}
          min={minDate}
          max={maxDate}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
          aria-invalid={Boolean(errors.date)}
          aria-describedby={errors.date ? "date-error" : undefined}
        />
        {errors.date && (
          <p id="date-error" className={errorClass}>
            {errors.date}
          </p>
        )}
        <p className="mt-1 text-xs text-slate-400">
          Selectable between {toReadable(minDate)} and {toReadable(maxDate)}.
        </p>
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Any extra detail..."
          className={inputClass}
        />
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
          {initialExpense ? "Save changes" : "Add expense"}
        </button>
      </div>
    </form>
  );
}

function toReadable(iso: string): string {
  return fromISODateString(iso).toLocaleDateString("en-NZ", { day: "2-digit", month: "short", year: "numeric" });
}
