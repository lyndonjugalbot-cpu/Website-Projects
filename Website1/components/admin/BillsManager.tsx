"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCentavosAsPHP } from "@/lib/money";
import { billStatus, billsToIcs, describeDue, type BillStatus } from "@/lib/bills";

type Bill = {
  id: string;
  name: string;
  amountCentavos: number;
  dueDate: string; // YYYY-MM-DD (Manila)
  recurrence: "NONE" | "MONTHLY";
  reminderDaysBefore: number;
  isPaid: boolean;
  paidDate: string | null;
  paidAmountCentavos: number | null;
  paidByName: string | null;
  note: string | null;
};

const STATUS_STYLES: Record<BillStatus, { chip: string; badge: string; label: string }> = {
  overdue: { chip: "bg-red-100 text-red-800 border-red-200", badge: "bg-red-100 text-red-700", label: "Overdue" },
  "due-soon": { chip: "bg-amber-100 text-amber-900 border-amber-200", badge: "bg-amber-100 text-amber-800", label: "Due soon" },
  upcoming: { chip: "bg-neutral-100 text-neutral-800 border-neutral-200", badge: "bg-neutral-100 text-neutral-600", label: "Upcoming" },
  paid: { chip: "bg-emerald-50 text-emerald-800 border-emerald-200 line-through decoration-emerald-400", badge: "bg-emerald-100 text-emerald-700", label: "Paid" },
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const dateFormatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "UTC" });
const fmtDate = (d: string) => dateFormatter.format(new Date(`${d}T00:00:00Z`));

/** The 6-week grid (Sunday-first) that covers a "YYYY-MM" month. */
function gridFor(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first.getTime() - first.getUTCDay() * 86_400_000);
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10));
  return days;
}

const emptyForm = { name: "", amount: "", dueDate: "", recurrence: "NONE" as "NONE" | "MONTHLY", reminder: "3", note: "" };

export function BillsManager({ today }: { today: string }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm, dueDate: today });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(today);

  const grid = useMemo(() => gridFor(month), [month]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bills?start=${grid[0]}&end=${grid[41]}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load bills");
      setBills(data.bills);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load bills");
    } finally {
      setLoading(false);
    }
  }, [grid]);

  useEffect(() => {
    load();
  }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, Bill[]>();
    for (const b of bills) map.set(b.dueDate, [...(map.get(b.dueDate) ?? []), b]);
    return map;
  }, [bills]);

  const selected = bills.find((b) => b.id === selectedId) ?? null;
  const statusOf = (b: Bill) => billStatus(b, today);
  const attention = bills.filter((b) => ["overdue", "due-soon"].includes(statusOf(b)));
  const monthBills = bills.filter((b) => b.dueDate.startsWith(month));
  const monthUnpaidTotal = monthBills.filter((b) => !b.isPaid).reduce((s, b) => s + b.amountCentavos, 0);
  const monthPaidTotal = monthBills.filter((b) => b.isPaid).reduce((s, b) => s + (b.paidAmountCentavos ?? b.amountCentavos), 0);

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }

  function selectBill(b: Bill) {
    setSelectedId(b.id);
    setPayAmount(((b.paidAmountCentavos ?? b.amountCentavos) / 100).toFixed(2));
    setPayDate(b.paidDate ?? today);
  }

  function startEdit(b: Bill) {
    setEditingId(b.id);
    setForm({
      name: b.name,
      amount: (b.amountCentavos / 100).toFixed(2),
      dueDate: b.dueDate,
      recurrence: b.recurrence,
      reminder: String(b.reminderDaysBefore),
      note: b.note ?? "",
    });
    setFormError(null);
    document.getElementById("bill-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetForm(dueDate = today) {
    setEditingId(null);
    setForm({ ...emptyForm, dueDate });
    setFormError(null);
  }

  async function saveBill(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    const body = {
      name: form.name,
      amountCentavos: Math.round((Number.parseFloat(form.amount) || 0) * 100),
      dueDate: form.dueDate,
      recurrence: form.recurrence,
      reminderDaysBefore: Number.parseInt(form.reminder, 10) || 0,
      note: form.note || (editingId ? null : ""),
    };
    try {
      const res = await fetch(editingId ? `/api/admin/bills/${editingId}` : "/api/admin/bills", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save bill");
      // Jump the calendar to the month of the bill we just saved.
      setMonth(form.dueDate.slice(0, 7));
      resetForm(form.dueDate);
      await load();
      setSelectedId(data.bill.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save bill");
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/bills/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error ?? "Could not update bill");
      return false;
    }
    await load();
    return true;
  }

  async function markPaid(b: Bill) {
    await patch(b.id, {
      markPaid: true,
      paidAmountCentavos: Math.round((Number.parseFloat(payAmount) || 0) * 100),
      paidDate: payDate,
    });
  }

  async function removeBill(b: Bill) {
    if (!confirm(`Delete the bill "${b.name}" due ${fmtDate(b.dueDate)}?`)) return;
    const res = await fetch(`/api/admin/bills/${b.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error ?? "Could not delete bill");
      return;
    }
    setSelectedId(null);
    await load();
  }

  function downloadIcs() {
    const unpaid = bills.filter((b) => !b.isPaid);
    const blob = new Blob([billsToIcs(unpaid)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seoul-stop-kmart-bills.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {attention.length > 0 && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="font-medium text-neutral-900">Needs attention</h2>
          <ul className="mt-3 divide-y divide-neutral-100">
            {attention.map((b) => {
              const st = statusOf(b);
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <button type="button" onClick={() => selectBill(b)} className="text-left">
                    <span className="font-medium text-neutral-900">{b.name}</span>
                    <span className="ml-2 text-neutral-500">{describeDue(b.dueDate, today)}</span>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[st].badge}`}>{STATUS_STYLES[st].label}</span>
                    <span className="font-semibold text-neutral-900">{formatCentavosAsPHP(b.amountCentavos)}</span>
                    <button
                      type="button"
                      onClick={() => patch(b.id, { markPaid: true, paidDate: today })}
                      className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700 hover:border-emerald-500 hover:text-emerald-700"
                    >
                      Mark paid
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Calendar */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="h-8 w-8 rounded-full border border-neutral-200 hover:border-neutral-400">
              ‹
            </button>
            <h2 className="min-w-[10rem] text-center font-medium text-neutral-900">
              {MONTH_NAMES[Number(month.slice(5)) - 1]} {month.slice(0, 4)}
            </h2>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="h-8 w-8 rounded-full border border-neutral-200 hover:border-neutral-400">
              ›
            </button>
            <button type="button" onClick={() => setMonth(today.slice(0, 7))} className="ml-1 text-xs font-medium text-brand-red hover:underline">
              Today
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            <span>
              To pay this month: <strong className="text-neutral-900">{formatCentavosAsPHP(monthUnpaidTotal)}</strong>
            </span>
            <span>
              Paid: <strong className="text-emerald-700">{formatCentavosAsPHP(monthPaidTotal)}</strong>
            </span>
            <button type="button" onClick={downloadIcs} className="rounded-full border border-neutral-200 px-3 py-1 font-medium text-neutral-700 hover:border-neutral-400">
              Add to my calendar (.ics)
            </button>
          </div>
        </div>

        <div className={`mt-4 overflow-x-auto ${loading ? "opacity-60" : ""}`}>
          <div className="grid min-w-[640px] grid-cols-7 border-l border-t border-neutral-200 text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="border-b border-r border-neutral-200 bg-neutral-50 px-2 py-1.5 font-medium text-neutral-500">
                {d}
              </div>
            ))}
            {grid.map((day) => {
              const inMonth = day.startsWith(month);
              const dayBills = byDay.get(day) ?? [];
              return (
                <div
                  key={day}
                  onClick={() => {
                    if (!editingId) setForm((f) => ({ ...f, dueDate: day }));
                  }}
                  className={`min-h-[84px] cursor-pointer border-b border-r border-neutral-200 p-1.5 ${inMonth ? "bg-white" : "bg-neutral-50/70"} hover:bg-neutral-50`}
                >
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${
                      day === today ? "bg-brand-red font-semibold text-white" : inMonth ? "text-neutral-700" : "text-neutral-300"
                    }`}
                  >
                    {Number(day.slice(8))}
                  </span>
                  <div className="mt-1 flex flex-col gap-1">
                    {dayBills.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectBill(b);
                        }}
                        title={`${b.name} — ${formatCentavosAsPHP(b.amountCentavos)}`}
                        className={`truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium ${STATUS_STYLES[statusOf(b)].chip} ${
                          selectedId === b.id ? "ring-2 ring-brand-red" : ""
                        }`}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-3 flex flex-wrap gap-3 text-[11px] text-neutral-500">
          {(Object.keys(STATUS_STYLES) as BillStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded border ${STATUS_STYLES[s].chip.split(" ").slice(0, 3).join(" ")}`} />
              {STATUS_STYLES[s].label}
            </span>
          ))}
          <span>Click a day to start a bill on that date.</span>
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Selected bill */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="font-medium text-neutral-900">Bill details</h2>
          {!selected ? (
            <p className="mt-3 text-sm text-neutral-400">Select a bill on the calendar to pay, edit or delete it.</p>
          ) : (
            <div className="mt-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-neutral-900">{selected.name}</p>
                  <p className="text-neutral-500">
                    {fmtDate(selected.dueDate)} · {selected.isPaid ? "paid" : describeDue(selected.dueDate, today)}
                    {selected.recurrence === "MONTHLY" && " · repeats monthly"}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[statusOf(selected)].badge}`}>
                  {STATUS_STYLES[statusOf(selected)].label}
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">{formatCentavosAsPHP(selected.amountCentavos)}</p>
              {selected.note && <p className="mt-1 text-neutral-500">{selected.note}</p>}
              <p className="mt-1 text-xs text-neutral-400">Reminder: {selected.reminderDaysBefore} day(s) before the due date.</p>

              {selected.isPaid ? (
                <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-emerald-800">
                  Paid {formatCentavosAsPHP(selected.paidAmountCentavos ?? selected.amountCentavos)} on {selected.paidDate ? fmtDate(selected.paidDate) : "—"}
                  {selected.paidByName && ` by ${selected.paidByName}`}.
                  <button type="button" onClick={() => patch(selected.id, { markPaid: false })} className="ml-3 text-xs font-medium underline">
                    Undo
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-neutral-700">Amount paid (₱)</span>
                    <input type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="input w-36" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-neutral-700">Date paid</span>
                    <input type="date" value={payDate} max={today} onChange={(e) => setPayDate(e.target.value)} className="input w-40" />
                  </label>
                  <button
                    type="button"
                    onClick={() => markPaid(selected)}
                    className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Mark paid
                  </button>
                </div>
              )}

              <div className="mt-4 flex gap-4 text-xs font-medium">
                <button type="button" onClick={() => startEdit(selected)} className="text-neutral-600 hover:text-neutral-900">
                  Edit
                </button>
                <button type="button" onClick={() => removeBill(selected)} className="text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Add / edit */}
        <form id="bill-form" onSubmit={saveBill} className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="font-medium text-neutral-900">{editingId ? "Edit bill" : "Add a bill"}</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <label className="col-span-2 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-neutral-700">Bill</span>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. VECO electricity" className="input" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-neutral-700">Amount (₱)</span>
              <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-neutral-700">Due date</span>
              <input required type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="input" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-neutral-700">Repeats</span>
              <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value as "NONE" | "MONTHLY" })} className="input">
                <option value="NONE">One time</option>
                <option value="MONTHLY">Every month</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-neutral-700">Remind me (days before)</span>
              <input type="number" min="0" max="30" value={form.reminder} onChange={(e) => setForm({ ...form, reminder: e.target.value })} className="input" />
            </label>
            <label className="col-span-2 flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-neutral-700">Note (optional)</span>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="input" />
            </label>
          </div>
          {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-brand-red px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Add bill"}
            </button>
            {editingId && (
              <button type="button" onClick={() => resetForm()} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
                Cancel
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-neutral-400">
            Overdue and soon-due bills show a banner across the admin. Marking a monthly bill paid creates next month&apos;s automatically.
          </p>
        </form>
      </div>
    </div>
  );
}
