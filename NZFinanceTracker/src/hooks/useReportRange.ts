import { useMemo, useState } from "react";
import {
  clampRangeToRetention,
  getLastMonthRange,
  getLastWeekRange,
  getStartOfMonth,
  getStartOfWeek,
  getThisMonthRange,
  getThisWeekRange,
  toISODateString,
} from "../utils/date";
import type { DateRange, QuickRangeOption, ReportView } from "../types";
import { startOfDay } from "date-fns";

function rangesMatch(a: DateRange, b: DateRange): boolean {
  return toISODateString(a.start) === toISODateString(b.start) && toISODateString(a.end) === toISODateString(b.end);
}

/** Infers which quick-select option (if any) a range corresponds to, for keeping the control highlighted correctly. */
function inferQuickOption(range: DateRange, today: Date): QuickRangeOption {
  if (rangesMatch(range, getThisWeekRange(today))) return "thisWeek";
  if (rangesMatch(range, getLastWeekRange(today))) return "lastWeek";
  if (rangesMatch(range, getThisMonthRange(today))) return "thisMonth";
  if (rangesMatch(range, getLastMonthRange(today))) return "lastMonth";
  return "custom";
}

export function useReportRange(today: Date = startOfDay(new Date())) {
  const [view, setViewState] = useState<ReportView>("weekly");
  const [quickOption, setQuickOption] = useState<QuickRangeOption>("thisWeek");
  const [range, setRange] = useState<DateRange>(() => clampRangeToRetention(getThisWeekRange(today), today));

  const applyQuickOption = (option: QuickRangeOption) => {
    setQuickOption(option);
    switch (option) {
      case "thisWeek":
        setViewState("weekly");
        setRange(clampRangeToRetention(getThisWeekRange(today), today));
        break;
      case "lastWeek":
        setViewState("weekly");
        setRange(clampRangeToRetention(getLastWeekRange(today), today));
        break;
      case "thisMonth":
        setViewState("monthly");
        setRange(clampRangeToRetention(getThisMonthRange(today), today));
        break;
      case "lastMonth":
        setViewState("monthly");
        setRange(clampRangeToRetention(getLastMonthRange(today), today));
        break;
      case "custom":
        break;
    }
  };

  const setCustomRange = (start: Date, end: Date) => {
    setQuickOption("custom");
    const normalized: DateRange = start.getTime() <= end.getTime() ? { start, end } : { start: end, end: start };
    setRange(clampRangeToRetention(normalized, today));
  };

  const jumpToDate = (date: Date) => {
    if (view === "weekly") {
      const start = getStartOfWeek(date);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const nextRange = clampRangeToRetention({ start, end }, today);
      setQuickOption(inferQuickOption(nextRange, today));
      setRange(nextRange);
    } else {
      const start = getStartOfMonth(date);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      const nextRange = clampRangeToRetention({ start, end }, today);
      setQuickOption(inferQuickOption(nextRange, today));
      setRange(nextRange);
    }
  };

  const setView = (nextView: ReportView) => {
    setViewState(nextView);
    const anchor = range.start;
    let nextRange: DateRange;
    if (nextView === "weekly") {
      const start = getStartOfWeek(anchor);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      nextRange = clampRangeToRetention({ start, end }, today);
    } else {
      const start = getStartOfMonth(anchor);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      nextRange = clampRangeToRetention({ start, end }, today);
    }
    setQuickOption(inferQuickOption(nextRange, today));
    setRange(nextRange);
  };

  return useMemo(
    () => ({ view, setView, quickOption, applyQuickOption, range, setCustomRange, jumpToDate }),
    [view, quickOption, range],
  );
}
