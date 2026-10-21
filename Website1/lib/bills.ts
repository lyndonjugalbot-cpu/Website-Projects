// Pure helpers for the bills tracker (safe to import from client components).
// Due dates are Manila calendar dates ("YYYY-MM-DD"); a stored Bill.dueDate
// is Manila midnight of that date.

export type BillStatus = "paid" | "overdue" | "due-soon" | "upcoming";

const DAY_MS = 86_400_000;
const toUtc = (d: string) => new Date(`${d}T00:00:00Z`);

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string) {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS);
}

export function billStatus(
  bill: { isPaid: boolean; dueDate: string; reminderDaysBefore: number },
  today: string
): BillStatus {
  if (bill.isPaid) return "paid";
  const days = daysBetween(today, bill.dueDate);
  if (days < 0) return "overdue";
  if (days <= bill.reminderDaysBefore) return "due-soon";
  return "upcoming";
}

/** Same day next month, clamped to the month's last day (Jan 31 -> Feb 28). */
export function addOneMonth(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

export function describeDue(dueDate: string, today: string) {
  const days = daysBetween(today, dueDate);
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days > 1) return `due in ${days} days`;
  return `${-days} day${days === -1 ? "" : "s"} overdue`;
}

/** An all-day iCalendar event with a reminder, for adding unpaid bills to a phone/Google calendar. */
export function billsToIcs(
  bills: { id: string; name: string; amountCentavos: number; dueDate: string; reminderDaysBefore: number; note: string | null }[]
) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Seoul Stop Kmart//Bills//EN", "CALSCALE:GREGORIAN"];
  for (const b of bills) {
    const day = b.dueDate.replace(/-/g, "");
    const next = new Date(toUtc(b.dueDate).getTime() + DAY_MS).toISOString().slice(0, 10).replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@seoulstopkmart-bills`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day}`,
      `DTEND;VALUE=DATE:${next}`,
      `SUMMARY:${esc(`Bill due: ${b.name} (PHP ${(b.amountCentavos / 100).toFixed(2)})`)}`,
      ...(b.note ? [`DESCRIPTION:${esc(b.note)}`] : []),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(`${b.name} is due`)}`,
      `TRIGGER:-P${Math.max(0, b.reminderDaysBefore)}D`,
      "END:VALARM",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
