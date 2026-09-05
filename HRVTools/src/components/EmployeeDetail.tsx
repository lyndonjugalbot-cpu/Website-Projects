import { useMutation, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
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
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{employee?.name ?? "Employee"}</h1>
        {employee?.idNumber && (
          <p className="text-sm text-slate-500 dark:text-slate-400">ID: {employee.idNumber} · {employee.email}</p>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Weekly metrics
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
