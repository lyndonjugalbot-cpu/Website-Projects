import { format, startOfWeek } from "date-fns";

export function mondayOf(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function currentWeekStart(): string {
  return mondayOf(new Date());
}

export function formatWeekLabel(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00`);
  return format(d, "d MMM");
}

// A week belongs to the calendar month of its Monday.
export function monthKeyOf(weekStart: string): string {
  return weekStart.slice(0, 7); // "yyyy-MM"
}

export function formatMonthLabel(monthKey: string): string {
  const d = new Date(`${monthKey}-01T00:00:00`);
  return format(d, "MMM yyyy");
}
