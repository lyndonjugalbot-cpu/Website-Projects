// Correct or delete one time-clock entry (e.g. fill in a forgotten time-out).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { hoursBetween, toEntryRow } from "@/lib/shifts";

const isoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date/time");

const patchSchema = z.object({
  clockIn: isoDateTime.optional(),
  clockOut: isoDateTime.nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update" }, { status: 400 });
  }
  const existing = await prisma.timeEntry.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const clockIn = parsed.data.clockIn ? new Date(parsed.data.clockIn) : existing.clockIn;
  const clockOut = parsed.data.clockOut === undefined ? existing.clockOut : parsed.data.clockOut ? new Date(parsed.data.clockOut) : null;
  if (clockOut && clockOut <= clockIn) {
    return NextResponse.json({ error: "Time out must be after time in" }, { status: 400 });
  }
  if (clockOut && hoursBetween(clockIn, clockOut) > 24) {
    return NextResponse.json({ error: "A single shift can't be longer than 24 hours" }, { status: 400 });
  }

  const entry = await prisma.timeEntry.update({
    where: { id: params.id },
    data: {
      clockIn,
      clockOut,
      // Always recomputed from the two times, never trusted from the client.
      hoursWorked: clockOut ? hoursBetween(clockIn, clockOut) : null,
      ...(parsed.data.note !== undefined ? { note: parsed.data.note || null } : {}),
      editedByName: session.user.name ?? session.user.email ?? "Manager",
    },
  });
  return NextResponse.json({ entry: toEntryRow(entry) });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const { count } = await prisma.timeEntry.deleteMany({ where: { id: params.id } });
  if (count === 0) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
