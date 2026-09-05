import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { UserDoc } from "../types";
import { CoachingLogList } from "./CoachingLogList";
import { MetricsChart } from "./MetricsChart";

export function EmployeeApp({ user }: { user: UserDoc }) {
  const metrics = useQuery(api.metrics.listForEmployee, { employeeId: user._id });
  const logs = useQuery(api.coachingLogs.listForEmployee, { employeeId: user._id });

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          My weekly metrics
        </h2>
        {metrics === undefined ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        ) : (
          <MetricsChart metrics={metrics} />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          My coaching logs
        </h2>
        {logs === undefined ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        ) : (
          <CoachingLogList logs={logs} />
        )}
      </section>
    </div>
  );
}
