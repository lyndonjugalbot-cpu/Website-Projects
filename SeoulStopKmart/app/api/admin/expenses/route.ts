// Operating expenses (rent, utilities, etc.) logged by a manager/owner on
// the Reports page — these feed into the "Net profit/loss" figure in
// lib/reports.ts.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";

// Lists expenses, optionally within a date range.
export async function GET(request: NextRequest) {
  try {
    await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const expenses = await prisma.expense.findMany({
    where:
      startDate && endDate
        ? { date: { gte: new Date(`${startDate}T00:00:00+08:00`), lt: new Date(`${endDate}T23:59:59+08:00`) } }
        : {},
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ expenses });
}

const expenseSchema = z.object({
  date: z.string().min(1),
  category: z.string().trim().min(1, "Category is required").max(100),
  receiptName: z.string().trim().max(200).optional().or(z.literal("")),
  amountCentavos: z.number().int().min(1, "Amount must be greater than 0"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

// Logs a new expense.
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = expenseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid expense" }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      date: new Date(`${parsed.data.date}T00:00:00+08:00`),
      category: parsed.data.category,
      receiptName: parsed.data.receiptName || null,
      amountCentavos: parsed.data.amountCentavos,
      note: parsed.data.note || null,
      createdByName: session.user.name ?? session.user.email ?? "Staff",
    },
  });

  return NextResponse.json({ expense }, { status: 201 });
}
