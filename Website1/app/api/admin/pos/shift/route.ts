// Everything the register's "My shift" panel needs in one call: the
// signed-in user's time-clock state and cash-drawer state.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { getOpenCashSession, getOpenTimeEntry } from "@/lib/shifts";
import { manilaDayEndUtc, manilaDayStartUtc, todayInManila } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function GET() {
  let session;
  try {
    session = await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const userId = session.user.id;
  const today = todayInManila();

  const [openEntry, openCash, todaysEntries, lastCash] = await Promise.all([
    getOpenTimeEntry(userId),
    getOpenCashSession(userId),
    prisma.timeEntry.findMany({
      where: { userId, clockIn: { gte: manilaDayStartUtc(today), lt: manilaDayEndUtc(today) } },
      orderBy: { clockIn: "asc" },
    }),
    prisma.cashSession.findFirst({ where: { userId, closedAt: { not: null } }, orderBy: { closedAt: "desc" } }),
  ]);

  const todayHours = todaysEntries.reduce((sum, e) => sum + (e.hoursWorked ?? 0), 0);

  return NextResponse.json({
    timeEntry: openEntry,
    todayHours: Math.round(todayHours * 100) / 100,
    todayEntries: todaysEntries,
    cashSession: openCash,
    // Shown at the start of a shift so the cashier can compare with the last close.
    // Expected totals are deliberately never sent to the register (blind count).
    lastClose: lastCash
      ? {
          closedAt: lastCash.closedAt,
          closingCashCentavos: lastCash.closingCashCentavos,
          closingGcashCentavos: lastCash.closingGcashCentavos,
        }
      : null,
  });
}
