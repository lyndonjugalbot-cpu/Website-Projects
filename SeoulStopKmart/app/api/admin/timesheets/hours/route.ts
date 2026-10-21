// Clocked hours for one employee over a pay period — feeds the payslip
// generator's "use clocked hours" button.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { sumClockedHours } from "@/lib/shifts";
import { manilaDayEndUtc, manilaDayStartUtc } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function GET(request: NextRequest) {
  try {
    await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const p = request.nextUrl.searchParams;
  const parsed = z
    .object({ employeeId: z.string().min(1), start: dateString, end: dateString })
    .safeParse({ employeeId: p.get("employeeId"), start: p.get("start"), end: p.get("end") });
  if (!parsed.success) return NextResponse.json({ error: "employeeId, start and end are required" }, { status: 400 });

  const employee = await prisma.employee.findUnique({ where: { id: parsed.data.employeeId }, select: { userId: true } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (!employee.userId) return NextResponse.json({ linked: false, hours: 0, shifts: 0, openShifts: 0 });

  const from = manilaDayStartUtc(parsed.data.start);
  const to = manilaDayEndUtc(parsed.data.end);
  const [{ hours, shifts }, openShifts] = await Promise.all([
    sumClockedHours(employee.userId, from, to),
    // Shifts with no time-out can't be counted yet — tell the manager.
    prisma.timeEntry.count({ where: { userId: employee.userId, clockOut: null, clockIn: { gte: from, lt: to } } }),
  ]);
  return NextResponse.json({ linked: true, hours, shifts, openShifts });
}
