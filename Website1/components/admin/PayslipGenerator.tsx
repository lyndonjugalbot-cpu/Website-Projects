"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatCentavosAsPHP } from "@/lib/money";
import { todayInManila } from "@/lib/timezone";
import { computeHolidayBonusCentavos, computeRegularPayCentavos } from "@/lib/payroll";
import type { Employee } from "@/components/admin/EmployeeManager";

type Adjustment = { label: string; amountInput: string };
type Holiday = { label: string; percentInput: string };

type Payslip = {
  id: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  netPayCentavos: number;
  createdAt: string;
};

export function PayslipGenerator({ employees, initialPayslips }: { employees: Employee[]; initialPayslips: Payslip[] }) {
  const activeEmployees = employees.filter((emp) => emp.isActive);
  const activeIds = activeEmployees.map((emp) => emp.id).join(",");
  const today = todayInManila();

  const [employeeId, setEmployeeId] = useState(activeEmployees[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState(today);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [hoursWorkedInput, setHoursWorkedInput] = useState("");
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payslips, setPayslips] = useState(initialPayslips);

  // activeEmployees is a new array every render, so this only re-runs when
  // the underlying set of active ids actually changes (e.g. an employee was
  // just added, or the current selection was deactivated) — otherwise a
  // freshly-added employee never becomes selectable because the <select>'s
  // initial value was locked in before it existed.
  useEffect(() => {
    if (!activeEmployees.some((emp) => emp.id === employeeId)) {
      setEmployeeId(activeEmployees[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIds]);

  const selectedEmployee = activeEmployees.find((emp) => emp.id === employeeId);
  const hoursWorked = Number.parseFloat(hoursWorkedInput) || 0;
  const dailyRateCentavos = selectedEmployee?.dailyRateCentavos ?? 0;
  const regularPayCentavos = computeRegularPayCentavos(dailyRateCentavos, hoursWorked);
  const holidayBonusTotalCentavos = holidays.reduce(
    (sum, h) => sum + computeHolidayBonusCentavos(dailyRateCentavos, Number.parseFloat(h.percentInput) || 0),
    0
  );
  const adjustmentsTotalCentavos = adjustments.reduce(
    (sum, a) => sum + Math.round((Number.parseFloat(a.amountInput) || 0) * 100),
    0
  );
  const previewNetPayCentavos = regularPayCentavos + holidayBonusTotalCentavos + adjustmentsTotalCentavos;

  function addHoliday() {
    setHolidays([...holidays, { label: "", percentInput: "" }]);
  }
  function updateHoliday(index: number, patch: Partial<Holiday>) {
    setHolidays(holidays.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  }
  function removeHoliday(index: number) {
    setHolidays(holidays.filter((_, i) => i !== index));
  }

  function addAdjustment() {
    setAdjustments([...adjustments, { label: "", amountInput: "" }]);
  }
  function updateAdjustment(index: number, patch: Partial<Adjustment>) {
    setAdjustments(adjustments.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }
  function removeAdjustment(index: number) {
    setAdjustments(adjustments.filter((_, i) => i !== index));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!employeeId) {
      setError("Select an employee");
      return;
    }
    if (hoursWorked <= 0) {
      setError("Enter hours worked greater than 0");
      return;
    }
    if (periodEnd < periodStart) {
      setError("Period end must be on or after period start");
      return;
    }
    const cleanHolidays = holidays
      .filter((h) => h.label.trim())
      .map((h) => ({ label: h.label.trim(), bonusPercent: Number.parseFloat(h.percentInput) || 0 }));
    const cleanAdjustments = adjustments
      .filter((a) => a.label.trim())
      .map((a) => ({ label: a.label.trim(), amountCentavos: Math.round((Number.parseFloat(a.amountInput) || 0) * 100) }));

    setIsGenerating(true);
    try {
      const res = await fetch("/api/admin/payslips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          periodStart,
          periodEnd,
          hoursWorked,
          holidays: cleanHolidays,
          adjustments: cleanAdjustments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate payslip");
      setPayslips([data.payslip, ...payslips]);
      setHoursWorkedInput("");
      setHolidays([]);
      setAdjustments([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate payslip");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleGenerate} className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-medium text-neutral-900">Generate a payslip</h2>

        {activeEmployees.length === 0 ? (
          <p className="text-sm text-neutral-500">Add an active employee above first.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-neutral-700">Employee</span>
                <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="input">
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-neutral-700">Period start</span>
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="input" required />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-neutral-700">Period end</span>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="input" required />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-neutral-700">Hours worked</span>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  placeholder="e.g. 80"
                  value={hoursWorkedInput}
                  onChange={(e) => setHoursWorkedInput(e.target.value)}
                  className="input"
                  required
                />
              </label>
            </div>

            {selectedEmployee && (
              <p className="text-xs text-neutral-500">
                {selectedEmployee.name}&apos;s daily rate: {formatCentavosAsPHP(dailyRateCentavos)} — regular pay for{" "}
                {hoursWorked || 0} hrs: {formatCentavosAsPHP(regularPayCentavos)}
              </p>
            )}

            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700">Holidays (optional)</span>
                <button type="button" onClick={addHoliday} className="text-sm font-medium text-brand-red hover:underline">
                  + Add holiday
                </button>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Bonus pay as a % of the daily rate, e.g. 100% for a regular holiday, 30% for a special non-working day.
              </p>

              {holidays.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {holidays.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Holiday name (e.g. Christmas Day)"
                        value={h.label}
                        onChange={(e) => updateHoliday(i, { label: e.target.value })}
                        className="input flex-1"
                      />
                      <div className="flex w-40 items-center gap-1">
                        <input
                          type="number"
                          step="1"
                          placeholder="100"
                          value={h.percentInput}
                          onChange={(e) => updateHoliday(i, { percentInput: e.target.value })}
                          className="input"
                        />
                        <span className="text-sm text-neutral-500">%</span>
                      </div>
                      <span className="w-24 text-right text-xs text-neutral-500">
                        {formatCentavosAsPHP(computeHolidayBonusCentavos(dailyRateCentavos, Number.parseFloat(h.percentInput) || 0))}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeHoliday(i)}
                        className="rounded-full px-2.5 py-1.5 text-sm text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                        aria-label="Remove holiday"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700">Adjustments (optional)</span>
                <button type="button" onClick={addAdjustment} className="text-sm font-medium text-brand-red hover:underline">
                  + Add line
                </button>
              </div>
              <p className="mt-1 text-xs text-neutral-500">Positive for bonuses/allowances, negative for deductions/absences/cash advances.</p>

              {adjustments.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {adjustments.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Label (e.g. Overtime, Absence)"
                        value={a.label}
                        onChange={(e) => updateAdjustment(i, { label: e.target.value })}
                        className="input flex-1"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount (₱, use - for deductions)"
                        value={a.amountInput}
                        onChange={(e) => updateAdjustment(i, { amountInput: e.target.value })}
                        className="input w-48"
                      />
                      <button
                        type="button"
                        onClick={() => removeAdjustment(i)}
                        className="rounded-full px-2.5 py-1.5 text-sm text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                        aria-label="Remove adjustment"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
              <span className="text-sm font-medium text-neutral-700">Net pay preview</span>
              <span className="text-lg font-semibold text-neutral-900">{formatCentavosAsPHP(previewNetPayCentavos)}</span>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={isGenerating}
              className="self-start rounded-full bg-brand-red px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isGenerating ? "Generating…" : "Generate payslip"}
            </button>
          </>
        )}
      </form>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Period</th>
              <th className="px-4 py-3 font-medium">Net pay</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {payslips.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-neutral-400">
                  No payslips generated yet.
                </td>
              </tr>
            )}
            {payslips.map((p) => (
              <tr key={p.id} className="border-b border-neutral-100 last:border-b-0">
                <td className="px-4 py-3 text-neutral-900">{p.employeeName}</td>
                <td className="px-4 py-3 text-neutral-600">
                  {new Date(p.periodStart).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })} –{" "}
                  {new Date(p.periodEnd).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}
                </td>
                <td className="px-4 py-3 font-medium text-neutral-900">{formatCentavosAsPHP(p.netPayCentavos)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/payroll/${p.id}/payslip`} className="text-sm font-medium text-brand-red hover:underline">
                    View / print
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
