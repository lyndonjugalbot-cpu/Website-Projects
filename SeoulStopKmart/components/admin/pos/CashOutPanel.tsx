"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCentavosAsPHP } from "@/lib/money";
import { CASH_OUT_CATEGORIES, CASH_OUT_LABELS } from "@/lib/cashout-config";
import type { CashOutCategory } from "@/lib/cashout-config";
import { SHIFT_CHANGED_EVENT } from "./ShiftStatus";

type CashOut = {
  id: string;
  category: string;
  payee: string | null;
  amountCentavos: number;
  paidFrom: string;
  note: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
};

const NEEDS_EMPLOYEE: CashOutCategory[] = ["SALARY", "CASH_ADVANCE"];

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-PH", { timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));
}

// The Shift tab's right column: money taken out of the register during the
// shift (salary, CA, bills…). It comes off the drawer's expected balance, so
// the end-of-shift count still balances.
export function CashOutPanel() {
  const [hasOpenSession, setHasOpenSession] = useState<boolean | null>(null);
  const [cashOuts, setCashOuts] = useState<CashOut[]>([]);
  const [category, setCategory] = useState<CashOutCategory>("SALARY");
  const [payee, setPayee] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [paidFrom, setPaidFrom] = useState<"cash" | "gcash">("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pos/cash-outs", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setHasOpenSession(data.hasOpenSession);
        setCashOuts(data.cashOuts);
      }
    } catch {
      // Offline blip — keep showing what we have.
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20_000);
    window.addEventListener("focus", load);
    // The Cash drawer card fires this when the drawer is opened or closed.
    window.addEventListener(SHIFT_CHANGED_EVENT, load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
      window.removeEventListener(SHIFT_CHANGED_EVENT, load);
    };
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amountCentavos = Math.round((Number.parseFloat(amountInput) || 0) * 100);
    if (amountCentavos <= 0) {
      setError("Enter an amount greater than 0");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pos/cash-outs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, payee, amountCentavos, paidFrom, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not record the cash out");
      setPayee("");
      setAmountInput("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the cash out");
    } finally {
      setSaving(false);
    }
  }

  async function handleVoid(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/pos/cash-outs/${id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not void the cash out");
      setVoidingId(null);
      setVoidReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not void the cash out");
    }
  }

  const active = cashOuts.filter((c) => !c.voidedAt);
  const totalOut = active.reduce((sum, c) => sum + c.amountCentavos, 0);

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-neutral-500">Cash out</h2>
          <p className="mt-1 text-lg font-semibold tracking-tight text-neutral-900">Money taken from the register</p>
        </div>
        {active.length > 0 && (
          <span className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold tabular-nums text-brand-red">
            {formatCentavosAsPHP(totalOut)} out this shift
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Salary, cash advance, bills and anything else. It&apos;s taken off your drawer total.
      </p>

      {hasOpenSession === false ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3.5 text-sm text-amber-900">
          <span aria-hidden className="mt-0.5">⚠</span>
          <p>
            Record your start-of-shift cash count first (the <strong className="font-medium">Cash drawer</strong> card). Cash outs come off that
            drawer.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-neutral-600">What for</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as CashOutCategory)} className="input rounded-xl py-2.5">
              {CASH_OUT_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-neutral-600">
              {NEEDS_EMPLOYEE.includes(category) ? "Employee name" : "Paid to / which bill (optional)"}
            </span>
            <input
              type="text"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              required={NEEDS_EMPLOYEE.includes(category)}
              className="input rounded-xl py-2.5"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-neutral-600">Amount</span>
            <span className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-neutral-400">₱</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                required
                placeholder="0.00"
                className="input rounded-xl py-2.5 pl-8 text-base tabular-nums"
              />
            </span>
          </label>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-neutral-600">Taken from</span>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1">
              {(["cash", "gcash"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaidFrom(m)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    paidFrom === m ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  {m === "cash" ? "Cash drawer" : "GCash"}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="text-xs font-medium text-neutral-600">Note (optional)</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="input rounded-xl py-2.5" />
          </label>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-brand-red px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-red-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 sm:col-span-2"
          >
            {saving ? "Saving…" : "Record cash out"}
          </button>
        </form>
      )}

      <div className="mt-6 border-t border-neutral-100 pt-4">
        <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">This shift</h3>
        {cashOuts.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-400">No cash outs yet.</p>
        ) : (
          <ul className="mt-1 divide-y divide-neutral-100">
            {cashOuts.map((c) => (
              <li key={c.id} className="py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className={c.voidedAt ? "text-neutral-400 line-through" : "text-neutral-800"}>
                    <span className="font-medium">{CASH_OUT_LABELS[c.category] ?? c.category}</span>
                    {c.payee && <span> · {c.payee}</span>}
                    <span className="block text-xs text-neutral-400 no-underline">
                      {formatTime(c.createdAt)} · from {c.paidFrom === "gcash" ? "GCash" : "cash drawer"}
                      {c.note ? ` · ${c.note}` : ""}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold tabular-nums ${c.voidedAt ? "text-neutral-400 line-through" : "text-neutral-900"}`}>
                      -{formatCentavosAsPHP(c.amountCentavos)}
                    </p>
                    {c.voidedAt ? (
                      <p className="text-xs text-neutral-400">Voided</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setVoidingId(voidingId === c.id ? null : c.id);
                          setVoidReason("");
                          setError(null);
                        }}
                        className="text-xs font-medium text-neutral-400 hover:text-red-600"
                      >
                        Void
                      </button>
                    )}
                  </div>
                </div>
                {voidingId === c.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      placeholder="Why? e.g. wrong amount"
                      className="input min-w-[200px] flex-1 rounded-xl py-1.5"
                      aria-label="Reason for voiding"
                    />
                    <button
                      type="button"
                      onClick={() => handleVoid(c.id)}
                      className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                    >
                      Void cash out
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
