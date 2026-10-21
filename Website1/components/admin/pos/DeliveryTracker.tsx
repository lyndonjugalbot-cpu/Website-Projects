"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCentavosAsPHP } from "@/lib/money";
import {
  presetRange,
  receiptsToCsv,
  summariseDeliveries,
  type RangePreset,
  type ReceiptRow,
} from "@/lib/deliveries";

type Receipt = ReceiptRow & { receiptNumber: string | null; note: string | null; createdByName: string | null };

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "last-90", label: "Last 90 days" },
  { id: "ytd", label: "Year to date" },
  { id: "all", label: "All time" },
];

const dateFormatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "UTC" });
const fmtDate = (d: string) => dateFormatter.format(new Date(`${d}T00:00:00Z`));

export function DeliveryTracker({ today, canManage }: { today: string; canManage: boolean }) {
  const [preset, setPreset] = useState<RangePreset | "custom">("this-month");
  const [range, setRange] = useState(() => presetRange("this-month", today));
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [previousTotal, setPreviousTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", number: "", amount: "", date: today, note: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pos/deliveries?start=${range.start}&end=${range.end}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load receipts");
      setReceipts(data.receipts);
      setPreviousTotal(data.previousTotalCentavos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load receipts");
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(
    () => summariseDeliveries(receipts, range.start, range.end, previousTotal),
    [receipts, range.start, range.end, previousTotal]
  );

  function choosePreset(id: RangePreset) {
    setPreset(id);
    setRange(presetRange(id, today));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const amountCentavos = Math.round((Number.parseFloat(form.amount) || 0) * 100);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pos/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptName: form.name,
          receiptNumber: form.number,
          amountCentavos,
          date: form.date,
          note: form.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save receipt");
      setForm({ name: "", number: "", amount: "", date: form.date, note: "" });
      // Make sure the new receipt is inside the visible range.
      if (form.date < range.start || form.date > range.end) {
        setPreset("custom");
        setRange({ start: form.date < range.start ? form.date : range.start, end: form.date > range.end ? form.date : range.end });
      } else {
        await load();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save receipt");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r: Receipt) {
    if (!confirm(`Delete "${r.name}" (${formatCentavosAsPHP(r.amountCentavos)}, ${fmtDate(r.date)})?`)) return;
    const res = await fetch(`/api/admin/pos/deliveries/${r.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error ?? "Could not delete receipt");
      return;
    }
    setReceipts((prev) => prev.filter((x) => x.id !== r.id));
  }

  async function handleEdit(r: Receipt) {
    const amountInput = prompt(`Amount for "${r.name}" (₱):`, (r.amountCentavos / 100).toFixed(2));
    if (amountInput === null) return;
    const amountCentavos = Math.round((Number.parseFloat(amountInput) || 0) * 100);
    const nameInput = prompt("Receipt name:", r.name);
    if (nameInput === null) return;
    const dateInput = prompt("Date (YYYY-MM-DD):", r.date);
    if (dateInput === null) return;
    const res = await fetch(`/api/admin/pos/deliveries/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptName: nameInput, amountCentavos, date: dateInput }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error ?? "Could not update receipt");
      return;
    }
    await load();
  }

  function downloadCsv() {
    const blob = new Blob([receiptsToCsv(receipts)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivery-receipts-${range.start}_to_${range.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const maxArea = Math.max(1, ...summary.chartAreas.map((a) => a.totalCentavos));
  const maxPoint = Math.max(1, ...summary.series.map((p) => p.totalCentavos));

  return (
    <div className="flex flex-col gap-8">
      {/* Add a receipt */}
      <form onSubmit={handleAdd} className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-medium text-neutral-900">Log a delivery receipt</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium text-neutral-700">Receipt name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. KW Korean Mart delivery"
              list="receipt-names"
              className="input"
            />
            <datalist id="receipt-names">
              {summary.areas.map((a) => (
                <option key={a.key} value={a.name} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Amount (₱)</span>
            <input
              required
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Date</span>
            <input required type="date" max={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Receipt no. (optional)</span>
            <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} className="input" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-3">
            <span className="font-medium text-neutral-700">Note (optional)</span>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="input" />
          </label>
        </div>
        {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
        <button
          type="submit"
          disabled={saving}
          className="mt-4 rounded-full bg-brand-red px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {saving ? "Saving…" : "Save receipt"}
        </button>
      </form>

      {/* Range filter */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => choosePreset(p.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                preset === p.id ? "bg-brand-red text-white" : "border border-neutral-200 text-neutral-600 hover:border-neutral-400"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            aria-label="Start date"
            value={range.start}
            max={range.end}
            onChange={(e) => {
              setPreset("custom");
              setRange({ ...range, start: e.target.value });
            }}
            className="input w-auto"
          />
          <span className="text-neutral-400">to</span>
          <input
            type="date"
            aria-label="End date"
            value={range.end}
            min={range.start}
            onChange={(e) => {
              setPreset("custom");
              setRange({ ...range, end: e.target.value });
            }}
            className="input w-auto"
          />
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={receipts.length === 0}
          className="ml-auto rounded-full border border-neutral-200 px-4 py-1.5 text-sm font-medium text-neutral-700 hover:border-neutral-400 disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Headline numbers */}
      <div className={`grid grid-cols-2 gap-4 lg:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
        <Kpi
          label="Total received"
          value={formatCentavosAsPHP(summary.totalCentavos)}
          sub={
            summary.changePercent === null
              ? `${summary.count} receipts`
              : `${summary.changePercent > 0 ? "▲" : summary.changePercent < 0 ? "▼" : ""} ${Math.abs(summary.changePercent)}% vs previous period`
          }
        />
        <Kpi label="Receipts" value={String(summary.count)} sub={`avg ${formatCentavosAsPHP(summary.averageCentavos)}`} />
        <Kpi
          label="Biggest supplier"
          value={summary.topArea?.name ?? "—"}
          sub={summary.topArea ? `${formatCentavosAsPHP(summary.topArea.totalCentavos)} · ${summary.topArea.sharePercent}%` : "no receipts"}
        />
        <Kpi
          label="Largest receipt"
          value={summary.largest ? formatCentavosAsPHP(summary.largest.amountCentavos) : "—"}
          sub={summary.largest ? `${summary.largest.name} · ${fmtDate(summary.largest.date)}` : "no receipts"}
        />
      </div>

      {summary.count > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="font-medium text-neutral-900">By receipt name</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {summary.chartAreas.map((a) => (
                <li key={a.key} className="text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="truncate text-neutral-700">{a.name}</span>
                    <span className="shrink-0 font-medium text-neutral-900">{formatCentavosAsPHP(a.totalCentavos)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-neutral-100">
                    <div
                      className={`h-2 rounded-full ${a.isOther ? "bg-neutral-400" : "bg-brand-red"}`}
                      style={{ width: `${(a.totalCentavos / maxArea) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="font-medium text-neutral-900">
              Over time <span className="text-xs font-normal text-neutral-400">({summary.granularity === "day" ? "daily" : summary.granularity === "week" ? "weekly" : "monthly"})</span>
            </h2>
            <div className="mt-4 flex h-40 items-end gap-1" role="img" aria-label="Delivery receipt totals over time">
              {summary.series.map((p) => (
                <div
                  key={p.date}
                  title={`${p.label}: ${formatCentavosAsPHP(p.totalCentavos)} (${p.count})`}
                  className="flex-1 rounded-t bg-brand-red/80"
                  style={{ height: `${Math.max(p.totalCentavos > 0 ? 3 : 0, (p.totalCentavos / maxPoint) * 100)}%`, minWidth: 2 }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-neutral-400">
              <span>{summary.series[0]?.label}</span>
              <span>{summary.series[summary.series.length - 1]?.label}</span>
            </div>
          </section>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Receipt</th>
              <th className="px-4 py-3 font-medium">No.</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Logged by</th>
              {canManage && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 && (
              <tr>
                <td colSpan={canManage ? 6 : 5} className="px-4 py-8 text-center text-sm text-neutral-400">
                  {loading ? "Loading…" : "No delivery receipts in this range."}
                </td>
              </tr>
            )}
            {receipts.map((r) => (
              <tr key={r.id} className="border-b border-neutral-100 last:border-b-0">
                <td className="whitespace-nowrap px-4 py-3 text-neutral-500">{fmtDate(r.date)}</td>
                <td className="px-4 py-3 text-neutral-900">
                  {r.name}
                  {r.note && <span className="block text-xs text-neutral-400">{r.note}</span>}
                </td>
                <td className="px-4 py-3 text-neutral-500">{r.receiptNumber ?? "—"}</td>
                <td className="px-4 py-3 text-right font-medium text-neutral-900">{formatCentavosAsPHP(r.amountCentavos)}</td>
                <td className="px-4 py-3 text-neutral-500">{r.createdByName ?? "—"}</td>
                {canManage && (
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button type="button" onClick={() => handleEdit(r)} className="mr-3 text-xs font-medium text-neutral-500 hover:text-neutral-900">
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(r)} className="text-xs font-medium text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1.5 truncate text-xl font-semibold text-neutral-900">{value}</p>
      <p className="mt-0.5 truncate text-xs text-neutral-500">{sub}</p>
    </div>
  );
}
