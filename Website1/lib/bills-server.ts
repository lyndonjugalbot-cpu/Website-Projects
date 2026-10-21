// Server-side bill queries shared by the admin layout (reminder banner),
// the dashboard card and the bills API.
import { prisma } from "@/lib/prisma";
import { billStatus } from "@/lib/bills";
import { manilaDateOf } from "@/lib/deliveries";
import { todayInManila } from "@/lib/timezone";

/** Largest reminder window a bill can have — bounds the query below. */
export const MAX_REMINDER_DAYS = 30;

export function toBillRow(b: {
  id: string;
  name: string;
  amountCentavos: number;
  dueDate: Date;
  recurrence: "NONE" | "MONTHLY";
  reminderDaysBefore: number;
  isPaid: boolean;
  paidAt: Date | null;
  paidAmountCentavos: number | null;
  paidByName: string | null;
  note: string | null;
}) {
  return {
    id: b.id,
    name: b.name,
    amountCentavos: b.amountCentavos,
    dueDate: manilaDateOf(b.dueDate),
    recurrence: b.recurrence,
    reminderDaysBefore: b.reminderDaysBefore,
    isPaid: b.isPaid,
    paidDate: b.paidAt ? manilaDateOf(b.paidAt) : null,
    paidAmountCentavos: b.paidAmountCentavos,
    paidByName: b.paidByName,
    note: b.note,
  };
}

/** How many unpaid bills are overdue / inside their reminder window right now. */
export async function getBillAlert() {
  const today = todayInManila();
  const horizon = new Date(Date.now() + (MAX_REMINDER_DAYS + 1) * 86_400_000);
  const unpaid = await prisma.bill.findMany({
    where: { isPaid: false, dueDate: { lte: horizon } },
    select: { dueDate: true, reminderDaysBefore: true, isPaid: true },
  });
  let overdue = 0;
  let dueSoon = 0;
  for (const b of unpaid) {
    const status = billStatus({ isPaid: b.isPaid, dueDate: manilaDateOf(b.dueDate), reminderDaysBefore: b.reminderDaysBefore }, today);
    if (status === "overdue") overdue++;
    else if (status === "due-soon") dueSoon++;
  }
  return { overdue, dueSoon };
}
