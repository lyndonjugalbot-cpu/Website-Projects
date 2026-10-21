// Timesheets for managers/owners: everyone's time-clock entries in a date
// range, plus manual entry creation (for a shift someone forgot to clock).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { hoursBetween, toEntryRow } from "@/lib/shifts";
import { manilaDayEndUtc, manilaDayStartUtc } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");
const isoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date/time");

export async function GET(request: NextRequest) {
  try {
    await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const p = request.nextUrl.searchParams;
  const range = z.object({ start: dateString, end: dateString }).safeParse({ start: p.get("start"), end: p.get("end") });
  if (!range.success) return NextResponse.json({ error: "start and end dates are required" }, { status: 400 });
  const userId = p.get("userId");

  const [entries, users] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        clockIn: { gte: manilaDayStartUtc(range.data.start), lt: manilaDayEndUtc(range.data.end) },
        ...(userId ? { userId } : {}),
      },
      orderBy: { clockIn: "desc" },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json({ entries: entries.map(toEntryRow), users });
}

const createSchema = z
  .object({
    userId: z.string().min(1, "Choose who worked this shift"),
    clockIn: isoDateTime,
    clockOut: isoDateTime,
    note: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((d) => Date.parse(d.clockOut) > Date.parse(d.clockIn), { message: "Time out must be after time in", path: ["clockOut"] });

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid shift" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const clockIn = new Date(parsed.data.clockIn);
  const clockOut = new Date(parsed.data.clockOut);
  if (hoursBetween(clockIn, clockOut) > 24) {
    return NextResponse.json({ error: "A single shift can't be longer than 24 hours" }, { status: 400 });
  }
  const entry = await prisma.timeEntry.create({
    data: {
      userId: user.id,
      userName: user.name,
      clockIn,
      clockOut,
      hoursWorked: hoursBetween(clockIn, clockOut),
      note: parsed.data.note || null,
      editedByName: session.user.name ?? session.user.email ?? "Manager",
    },
  });
  return NextResponse.json({ entry: toEntryRow(entry) }, { status: 201 });
}
