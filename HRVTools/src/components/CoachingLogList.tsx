import { format } from "date-fns";
import { ClipboardList, Trash2 } from "lucide-react";
import type { CoachingLogDoc } from "../types";

export function CoachingLogList({
  logs,
  onDelete,
}: {
  logs: CoachingLogDoc[];
  onDelete?: (logId: CoachingLogDoc["_id"]) => void;
}) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <ClipboardList size={20} className="text-slate-400" />
        No coaching logs yet.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {logs.map((log) => (
        <li
          key={log._id}
          className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {format(new Date(`${log.date}T00:00:00`), "d MMMM yyyy")}
            </p>
            {onDelete && (
              <button
                onClick={() => onDelete(log._id)}
                className="text-slate-400 transition hover:text-red-600 dark:hover:text-red-400"
                aria-label="Delete log"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Coaching opportunities
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                {log.coachingOpportunities}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Action plan
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{log.actionPlan}</p>
            </div>
          </div>

          {log.notes && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Notes
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{log.notes}</p>
            </div>
          )}

          {log.recordingUrl && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Call recording{log.recordingFileName ? ` — ${log.recordingFileName}` : ""}
              </p>
              <audio controls src={log.recordingUrl} className="w-full" />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
