import { useMutation } from "convex/react";
import { LoaderCircle, Plus } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { currentWeekStart, mondayOf } from "../lib/weeks";

const COMMON_METRICS = ["QA Score", "CSAT", "AHT (sec)", "Calls Handled", "Adherence %"];

export function AddMetricForm({ employeeId, onSaved }: { employeeId: Id<"users">; onSaved?: () => void }) {
  const recordMetric = useMutation(api.metrics.record);

  const [weekStart, setWeekStart] = useState(currentWeekStart());
  const [metricName, setMetricName] = useState(COMMON_METRICS[0]);
  const [customMetric, setCustomMetric] = useState("");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustom = metricName === "__custom__";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = isCustom ? customMetric.trim() : metricName;
    const numericValue = Number(value);
    if (!name) {
      setError("Enter a metric name.");
      return;
    }
    if (Number.isNaN(numericValue)) {
      setError("Enter a numeric value.");
      return;
    }

    setSubmitting(true);
    try {
      await recordMetric({ employeeId, weekStart, metricName: name, value: numericValue });
      setValue("");
      if (isCustom) setCustomMetric("");
      onSaved?.();
    } catch {
      setError("Could not save the metric. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-end sm:flex-wrap"
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Week of</label>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(mondayOf(new Date(`${e.target.value}T00:00:00`)))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Metric</label>
        <select
          value={metricName}
          onChange={(e) => setMetricName(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {COMMON_METRICS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          <option value="__custom__">Custom…</option>
        </select>
      </div>

      {isCustom && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Custom metric name</label>
          <input
            type="text"
            value={customMetric}
            onChange={(e) => setCustomMetric(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Value</label>
        <input
          type="number"
          step="any"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 sm:basis-full">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}
        Save metric
      </button>
    </form>
  );
}
