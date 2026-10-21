// Bills tracker — manager/owner only.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { MAX_REMINDER_DAYS, toBillRow } from "@/lib/bills-server";
import { manilaDayEndUtc, manilaDayStartUtc } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

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

  // Everything due in the window, plus every unpaid bill that is already
  // overdue (so a missed bill stays visible however far you scroll ahead).
  const bills = await prisma.bill.findMany({
    where: {
      OR: [
        { dueDate: { gte: manilaDayStartUtc(range.data.start), lt: manilaDayEndUtc(range.data.end) } },
        { isPaid: false, dueDate: { lt: manilaDayStartUtc(range.data.start) } },
      ],
    },
    orderBy: [{ dueDate: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ bills: bills.map(toBillRow) });
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Enter the bill name").max(200),
  amountCentavos: z.number().int().min(1, "Amount must be greater than 0").max(1_000_000_000),
  dueDate: dateString,
  recurrence: z.enum(["NONE", "MONTHLY"]).default("NONE"),
  reminderDaysBefore: z.number().int().min(0).max(MAX_REMINDER_DAYS).default(3),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid bill" }, { status: 400 });
  }
  const d = parsed.data;
  const bill = await prisma.bill.create({
    data: {
      name: d.name,
      amountCentavos: d.amountCentavos,
      dueDate: manilaDayStartUtc(d.dueDate),
      recurrence: d.recurrence,
      reminderDaysBefore: d.reminderDaysBefore,
      note: d.note || null,
      createdByName: session.user.name ?? session.user.email ?? "Manager",
    },
  });
  return NextResponse.json({ bill: toBillRow(bill) }, { status: 201 });
}
