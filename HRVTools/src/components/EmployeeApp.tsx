import { useQuery } from "convex/react";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { UserDoc } from "../types";
import { AddMetricForm } from "./AddMetricForm";
import { CoachingLogList } from "./CoachingLogList";
import { MetricsChart } from "./MetricsChart";
import { ProfileModal } from "./ProfileModal";

export function EmployeeApp({ user }: { user: UserDoc }) {
  const metrics = useQuery(api.metrics.listForEmployee, { employeeId: user._id });
  const logs = useQuery(api.coachingLogs.listForEmployee, { employeeId: user._id });
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            My profile
          </h2>
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Pencil size={14} />
            Edit profile
          </button>
        </div>
        <dl className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Complete name</dt>
            <dd className="text-slate-900 dark:text-white">{user.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">ID number</dt>
            <dd className="text-slate-900 dark:text-white">{user.idNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Contact number</dt>
            <dd className="text-slate-900 dark:text-white">{user.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Email</dt>
            <dd className="text-slate-900 dark:text-white">{user.email ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Address</dt>
            <dd className="whitespace-pre-line text-slate-900 dark:text-white">{user.address ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          My weekly stats
        </h2>
        <AddMetricForm employeeId={user._id} allowCustom={false} />
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

      {showProfile && (
        <ProfileModal user={user} title="Edit my profile" onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
}
