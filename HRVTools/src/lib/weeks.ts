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
