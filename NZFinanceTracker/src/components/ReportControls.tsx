import { CalendarDays, CalendarRange } from "lucide-react";
import type { DateRange, QuickRangeOption, ReportView } from "../types";
import { formatNZDateObj, getRetentionCutoff, toISODateString } from "../utils/date";

interface ReportControlsProps {
  view: ReportView;
  setView: (view: ReportView) => void;
  quickOption: QuickRangeOption;
  applyQuickOption: (option: QuickRangeOption) => void;
  range: DateRange;
  setCustomRange: (start: Date, end: Date) => void;
  jumpToDate: (date: Date) => void;
}

const QUICK_OPTIONS: { value: QuickRangeOption; label: string }[] = [
  { value: "thisWeek", label: "This week" },
  { value: "lastWeek", label: "Last week" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "custom", label: "Custom range" },
];

export function ReportControls({
  view,
  setView,
  quickOption,
  applyQuickOption,
  range,
  setCustomRange,
  jumpToDate,
}: ReportControlsProps) {
  const today = new Date();
  const minDate = toISODateString(getRetentionCutoff(today));
  const maxDate = toISODateString(today);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {QUICK_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => applyQuickOption(option.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                quickOption === option.value
                  ? "bg-brand-600 text-white shadow-sm"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setView("weekly")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === "weekly" ? "bg-ocean-600 text-white" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => setView("monthly")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === "monthly" ? "bg-ocean-600 text-white" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 border-t border-slate-100 pt-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            Jump to date
            <input
              type="date"
              min={minDate}
              max={maxDate}
              onChange={(e) => {
                if (e.target.value) jumpToDate(new Date(`${e.target.value}T00:00:00`));
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <CalendarRange className="h-4 w-4 text-slate-400" />
            From
            <input
              type="date"
              min={minDate}
              max={maxDate}
              value={toISODateString(range.start)}
              onChange={(e) => {
                if (e.target.value) setCustomRange(new Date(`${e.target.value}T00:00:00`), range.end);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            To
            <input
              type="date"
              min={minDate}
              max={maxDate}
              value={toISODateString(range.end)}
              onChange={(e) => {
                if (e.target.value) setCustomRange(range.start, new Date(`${e.target.value}T00:00:00`));
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </label>
        </div>

        <p className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Showing {formatNZDateObj(range.start, "d MMM yyyy")} – {formatNZDateObj(range.end, "d MMM yyyy")}
        </p>
      </div>
    </div>
  );
}
