"use client";

import { useState } from "react";
import { formatCentavosAsPHP } from "@/lib/money";

export type Employee = {
  id: string;
  name: string;
  position: string | null;
  basePayCentavos: number;
  isActive: boolean;
};

export function EmployeeManager({
  initialEmployees,
  onChange,
}: {
  initialEmployees: Employee[];
  onChange?: (employees: Employee[]) => void;
}) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [form, setForm] = useState({ name: "", position: "", basePayInput: "" });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(next: Employee[]) {
    setEmployees(next);
    onChange?.(next);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const basePayCentavos = Math.round((Number.parseFloat(form.basePayInput) || 0) * 100);
    if (!form.name.trim() || basePayCentavos <= 0) {
      setError("Enter a name and a base pay greater than 0");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, position: form.position, basePayCentavos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add employee");
      update([...employees, data.employee]);
      setForm({ name: "", position: "", basePayInput: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add employee");
    } finally {
      setIsCreating(false);
    }
  }

  async function patchEmployee(id: string, patch: { basePayCentavos?: number; position?: string; isActive?: boolean }) {
    const res = await fetch(`/api/admin/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Could not update employee");
      return;
    }
    update(employees.map((emp) => (emp.id === id ? { ...emp, ...data.employee } : emp)));
  }

  function handleEditBasePay(emp: Employee) {
    const input = prompt(`New base pay for ${emp.name} (₱ per period):`, (emp.basePayCentavos / 100).toFixed(2));
    if (input === null) return;
    const basePayCentavos = Math.round((Number.parseFloat(input) || 0) * 100);
    if (basePayCentavos <= 0) {
      alert("Base pay must be greater than 0");
      return;
    }
    patchEmployee(emp.id, { basePayCentavos });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Position</th>
              <th className="px-4 py-3 font-medium">Base pay / period</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-neutral-400">
                  No employees yet — add one below.
                </td>
              </tr>
            )}
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b border-neutral-100 last:border-b-0">
                <td className="px-4 py-3 text-neutral-900">{emp.name}</td>
                <td className="px-4 py-3 text-neutral-600">{emp.position ?? "—"}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleEditBasePay(emp)}
                    className="font-medium text-neutral-900 hover:text-brand-red hover:underline"
                  >
                    {formatCentavosAsPHP(emp.basePayCentavos)}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => patchEmployee(emp.id, { isActive: !emp.isActive })}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      emp.isActive ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-500"
                    }`}
                  >
                    {emp.isActive ? "Active" : "Deactivated"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleCreate} className="flex max-w-lg flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-medium text-neutral-900">Add an employee</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Name</span>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Position (optional)</span>
            <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="input" />
          </label>
        </div>
        <label className="flex max-w-[200px] flex-col gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Base pay per period (₱)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={form.basePayInput}
            onChange={(e) => setForm({ ...form, basePayInput: e.target.value })}
            className="input"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isCreating}
          className="self-start rounded-full bg-brand-red px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {isCreating ? "Adding…" : "Add employee"}
        </button>
      </form>
    </div>
  );
}
