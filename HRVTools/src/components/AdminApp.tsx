import { useQuery } from "convex/react";
import { UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AddEmployeeModal } from "./AddEmployeeModal";
import { EmployeeDetail } from "./EmployeeDetail";

export function AdminApp() {
  const employees = useQuery(api.users.listEmployees);
  const [selectedId, setSelectedId] = useState<Id<"users"> | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  if (selectedId) {
    return <EmployeeDetail employeeId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Employees</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          <UserPlus size={16} />
          Add employee
        </button>
      </div>

      {employees === undefined ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <Users size={20} className="text-slate-400" />
          No employees yet. Add your first employee to get started.
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {employees.map((emp) => (
            <li key={emp._id}>
              <button
                onClick={() => setSelectedId(emp._id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{emp.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ID: {emp.idNumber} · {emp.email}
                  </p>
                </div>
                <span className="text-xs text-brand-600 dark:text-brand-400">View →</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showAddModal && (
        <AddEmployeeModal onClose={() => setShowAddModal(false)} onCreated={() => undefined} />
      )}
    </div>
  );
}
