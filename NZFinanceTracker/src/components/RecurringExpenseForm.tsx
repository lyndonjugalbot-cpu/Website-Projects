import { useState } from "react";
import { EXPENSE_CATEGORIES, FREQUENCIES, FREQUENCY_LABELS, type ExpenseCategory } from "../config";
import type { Frequency, RecurringExpense, RecurringExpenseInput } from "../types";
import { parseAmountInput } from "../utils/currency";
import { toISODateString } from "../utils/date";

interface RecurringExpenseFormProps {
  initialExpense?: RecurringExpense;
  onSubmit: (input: RecurringExpenseInput) => void;
  onCancel: () => void;
}

interface FormErrors {
  description?: string;
  amount?: string;
}

export function RecurringExpenseForm({ initialExpense, onSubmit, onCancel }: RecurringExpenseFormProps) {
  const [description, setDescription] = useState(initialExpense?.description ?? "");
  const [amount, setAmount] = useState(initialExpense ? String(initialExpense.amount) : "");
  const [category, setCategory] = useState<ExpenseCategory>(initialExpense?.category ?? "Utilities");
  const [frequency, setFrequency] = useState<Frequency>(initialExpense?.frequency ?? "monthly");
  const [nextDueDate, setNextDueDate] = useState(initialExpense?.nextDueDate ?? toISODateString(new Date()));
  const [errors, setErrors] = useState<FormErrors>({});

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";
  const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";
  const errorClass = "mt-1 text-xs font-medium text-red-600 dark:text-red-400";

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (!description.trim()) nextErrors.description = "Please enter a description.";
    const parsedAmount = parseAmountInput(amount);
    if (parsedAmount === null || parsedAmount <= 0) nextErrors.amount = "Enter an amount greater than $0.00.";
    return nextErrors;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      description: description.trim(),
      amount: parseAmountInput(amount)!,
      category,
      frequency,
      nextDueDate,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <label htmlFor="recDescription" className={labelClass}>
          Description
        </label>
        <input
          id="recDescription"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Rent"
          className={inputClass}
          aria-invalid={Boolean(errors.description)}
        />
        {errors.description && <p className={errorClass}>{errors.description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="recAmount" className={labelClass}>
            Amount (NZD)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
            <input
              id="recAmount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`${inputClass} pl-6`}
              aria-invalid={Boolean(errors.amount)}
            />
          </div>
          {errors.amount && <p className={errorClass}>{errors.amount}</p>}
        </div>
        <div>
          <label htmlFor="recCategory" className={labelClass}>
            Category
          </label>
          <select
            id="recCategory"
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="recFrequency" className={labelClass}>
            Repeats
          </label>
          <select
            id="recFrequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
            className={inputClass}
          >
            {FREQUENCIES.map((freq) => (
              <option key={freq} value={freq}>
                {FREQUENCY_LABELS[freq]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="recNextDue" className={labelClass}>
            Next due date
          </label>
          <input
            id="recNextDue"
            type="date"
            value={nextDueDate}
            onChange={(e) => setNextDueDate(e.target.value)}
            className={inputClass}
          />
        </div>
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
          {initialExpense ? "Save changes" : "Add recurring expense"}
        </button>
      </div>
    </form>
  );
}
