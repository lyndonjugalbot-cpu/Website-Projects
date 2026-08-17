"use client";

import { useEffect, useState, useCallback } from "react";
import { formatCentavosAsPHP } from "@/lib/money";
import { todayInManila } from "@/lib/timezone";

type Expense = { id: string; date: string; category: string; amountCentavos: number; note: string | null };

export function ExpenseManager() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState(todayInManila());
  const [category, setCategory] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await fetch("/api/admin/expenses");
    const data = await res.json();
    setExpenses(data.expenses ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amountCentavos = Math.round((Number.parseFloat(amountInput) || 0) * 100);
    if (!category.trim() || amountCentavos <= 0) {
      setError("Enter a category and an amount greater than 0");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, category, amountCentavos, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add expense");
      setCategory("");
      setAmountInput("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add expense");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="font-medium text-neutral-900">Operating expenses</h2>
      <p className="mt-1 text-xs text-neutral-500">Rent, utilities, salaries, etc. — factored into Net profit/loss above.</p>

      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" required />
        <input type="text" placeholder="Category (e.g. Rent)" value={category} onChange={(e) => setCategory(e.target.value)} className="input" required />
        <input type="number" min="0" step="0.01" placeholder="Amount (₱)" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} className="input" required />
        <input type="text" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="input" />
        <button
          type="submit"
          disabled={isSaving}
          className="sm:col-span-4 self-start rounded-full bg-brand-red px-6 py-2 text-sm font-medium text-white transition hover:bg-brand-red-dark disabled:opacity-50"
        >
          {isSaving ? "Adding…" : "Add expense"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {!isLoading && expenses.length > 0 && (
        <table className="mt-5 w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="py-1.5 font-medium">Date</th>
              <th className="py-1.5 font-medium">Category</th>
              <th className="py-1.5 font-medium">Amount</th>
              <th className="py-1.5 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {expenses.slice(0, 10).map((e) => (
              <tr key={e.id} className="border-t border-neutral-100">
                <td className="py-1.5 text-neutral-500">{new Date(e.date).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}</td>
                <td className="py-1.5 text-neutral-700">{e.category}</td>
                <td className="py-1.5 text-neutral-900">{formatCentavosAsPHP(e.amountCentavos)}</td>
                <td className="py-1.5 text-neutral-500">{e.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
