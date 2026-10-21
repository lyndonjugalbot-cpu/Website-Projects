// Time clock + cashier drawer logic for the POS (used by
// app/api/admin/pos/{shift,time,cash}/route.ts and the admin timesheet/cash
// pages). Kept out of the route handlers so the rules live in one place.
import { prisma } from "@/lib/prisma";

export class ShiftError extends Error {}

// A clock-in older than this with no time-out is treated as a forgotten
// time-out: it stops blocking a new clock-in and is flagged for a manager
// to correct, instead of silently producing a 30-hour shift.
export const STALE_CLOCK_IN_HOURS = 16;

/** Hours between two instants, to 2 decimal places, never negative. */
export function hoursBetween(start: Date, end: Date): number {
  const ms = Math.max(0, end.getTime() - start.getTime());
  return Math.round((ms / 3_600_000) * 100) / 100;
}

type Actor = { id: string; name: string };

// --- Time clock -------------------------------------------------------------

/** The user's current un-closed, non-stale time entry, if any. */
export async function getOpenTimeEntry(userId: string) {
  const cutoff = new Date(Date.now() - STALE_CLOCK_IN_HOURS * 3_600_000);
  return prisma.timeEntry.findFirst({
    where: { userId, clockOut: null, clockIn: { gt: cutoff } },
    orderBy: { clockIn: "desc" },
  });
}

export async function clockIn(actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const cutoff = new Date(Date.now() - STALE_CLOCK_IN_HOURS * 3_600_000);
    const open = await tx.timeEntry.findFirst({ where: { userId: actor.id, clockOut: null, clockIn: { gt: cutoff } } });
    if (open) throw new ShiftError("You're already timed in.");
    return tx.timeEntry.create({ data: { userId: actor.id, userName: actor.name } });
  });
}

export async function clockOut(actor: Actor) {
  const open = await getOpenTimeEntry(actor.id);
  if (!open) throw new ShiftError("You're not timed in.");
  const now = new Date();
  // updateMany with clockOut:null makes a double-click a no-op, not a second close.
  const { count } = await prisma.timeEntry.updateMany({
    where: { id: open.id, clockOut: null },
    data: { clockOut: now, hoursWorked: hoursBetween(open.clockIn, now) },
  });
  if (count === 0) throw new ShiftError("You're not timed in.");
  return prisma.timeEntry.findUniqueOrThrow({ where: { id: open.id } });
}

/** Total closed hours for a user between two instants (used by payslips). */
export async function sumClockedHours(userId: string, from: Date, to: Date) {
  const entries = await prisma.timeEntry.findMany({
    where: { userId, clockOut: { not: null }, clockIn: { gte: from, lt: to } },
    select: { hoursWorked: true },
  });
  const hours = entries.reduce((sum, e) => sum + (e.hoursWorked ?? 0), 0);
  return { hours: Math.round(hours * 100) / 100, shifts: entries.length };
}

// --- Cash drawer ------------------------------------------------------------

export async function getOpenCashSession(userId: string) {
  return prisma.cashSession.findFirst({ where: { userId, closedAt: null }, orderBy: { openedAt: "desc" } });
}

/**
 * What the drawer / GCash balance *should* be: the opening amount plus this
 * cashier's completed, un-voided cash (or GCash) POS sales since opening.
 * A cash sale adds its total (cash received minus change given).
 */
export async function expectedBalances(
  session: { userId: string; openedAt: Date; openingCashCentavos: number; openingGcashCentavos: number },
  until: Date = new Date()
) {
  const sales = await prisma.order.groupBy({
    by: ["paymentMethod"],
    where: {
      channel: "POS",
      cashierId: session.userId,
      paymentStatus: "PAID",
      voidedAt: null,
      paymentMethod: { in: ["cash", "gcash"] },
      createdAt: { gte: session.openedAt, lte: until },
    },
    _sum: { totalCentavos: true },
    _count: true,
  });
  const sum = (m: string) => sales.find((s) => s.paymentMethod === m)?._sum.totalCentavos ?? 0;
  const count = (m: string) => sales.find((s) => s.paymentMethod === m)?._count ?? 0;
  return {
    cashSalesCentavos: sum("cash"),
    gcashSalesCentavos: sum("gcash"),
    cashSalesCount: count("cash"),
    gcashSalesCount: count("gcash"),
    expectedCashCentavos: session.openingCashCentavos + sum("cash"),
    expectedGcashCentavos: session.openingGcashCentavos + sum("gcash"),
  };
}

export async function openCashSession(actor: Actor, openingCashCentavos: number, openingGcashCentavos: number) {
  return prisma.$transaction(async (tx) => {
    const open = await tx.cashSession.findFirst({ where: { userId: actor.id, closedAt: null } });
    if (open) throw new ShiftError("You already have an open cash count. Close it first.");
    return tx.cashSession.create({
      data: { userId: actor.id, cashierName: actor.name, openingCashCentavos, openingGcashCentavos },
    });
  });
}

export async function closeCashSession(
  actor: Actor,
  closingCashCentavos: number,
  closingGcashCentavos: number,
  note?: string
) {
  const session = await getOpenCashSession(actor.id);
  if (!session) throw new ShiftError("You don't have an open cash count to close.");
  const closedAt = new Date();
  const expected = await expectedBalances(session, closedAt);
  const { count } = await prisma.cashSession.updateMany({
    where: { id: session.id, closedAt: null },
    data: {
      closedAt,
      closingCashCentavos,
      closingGcashCentavos,
      expectedCashCentavos: expected.expectedCashCentavos,
      expectedGcashCentavos: expected.expectedGcashCentavos,
      note: note || null,
    },
  });
  if (count === 0) throw new ShiftError("This cash count was already closed.");
  return prisma.cashSession.findUniqueOrThrow({ where: { id: session.id } });
}

/** Shape sent to the browser for one time-clock entry. */
export function toEntryRow(e: {
  id: string;
  userId: string;
  userName: string;
  clockIn: Date;
  clockOut: Date | null;
  hoursWorked: number | null;
  note: string | null;
  editedByName: string | null;
}) {
  const ageHours = (Date.now() - e.clockIn.getTime()) / 3_600_000;
  return {
    id: e.id,
    userId: e.userId,
    userName: e.userName,
    clockIn: e.clockIn.toISOString(),
    clockOut: e.clockOut?.toISOString() ?? null,
    hoursWorked: e.hoursWorked,
    note: e.note,
    editedByName: e.editedByName,
    // Still open long after the shift should have ended: a forgotten time-out.
    missedTimeOut: e.clockOut === null && ageHours > STALE_CLOCK_IN_HOURS,
    stillClockedIn: e.clockOut === null && ageHours <= STALE_CLOCK_IN_HOURS,
  };
}

