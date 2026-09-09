import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AddMetricForm } from "./AddMetricForm";
import { CoachingLogForm } from "./CoachingLogForm";
import { CoachingLogList } from "./CoachingLogList";
import { MetricsChart } from "./MetricsChart";

export function EmployeeDetail({ employeeId, onBack }: { employeeId: Id<"users">; onBack: () => void }) {
  const employee = useQuery(api.users.getEmployee, { employeeId });
  const metrics = useQuery(api.metrics.listForEmployee, { employeeId });
  const logs = useQuery(api.coachingLogs.listForEmployee, { employeeId });
  const removeLog = useMutation(api.coachingLogs.remove);
  const deleteEmployee = useMutation(api.admin.deleteEmployee);

  function handleDelete() {
    if (
      !confirm(
        `Delete ${employee?.name ?? "this employee"}? This removes their login, coaching logs and metrics.`,
      )
    ) {
      return;
    }
    void deleteEmployee({ employeeId }).then(onBack);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <button
          onClick={onBack}
          className="mb-3 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft size={14} />
          All employees
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{employee?.name ?? "Employee"}</h1>
            {employee?.idNumber && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                ID: {employee.idNumber} · {employee.email}
              </p>
            )}
            {employee?.phone && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{employee.phone}</p>
            )}
            {employee?.address && (
              <p className="whitespace-pre-line text-sm text-slate-500 dark:text-slate-400">
                {employee.address}
              </p>
            )}
          </div>
          <button
            onClick={handleDelete}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:text-red-400"
          >
            <Trash2 size={14} />
            Delete employee
          </button>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Stats
        </h2>
        {metrics === undefined ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        ) : (
          <MetricsChart metrics={metrics} />
        )}
        <AddMetricForm employeeId={employeeId} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          New coaching log
        </h2>
        <CoachingLogForm employeeId={employeeId} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Coaching log history
        </h2>
        {logs === undefined ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        ) : (
          <CoachingLogList logs={logs} onDelete={(logId) => void removeLog({ logId })} />
        )}
      </section>
    </div>
  );
}
