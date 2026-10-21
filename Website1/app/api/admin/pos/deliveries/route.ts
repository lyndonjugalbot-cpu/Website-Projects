// Delivery-receipt log. Any signed-in staff can read and add receipts;
// editing/deleting is manager-only (see [id]/route.ts).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { previousPeriod, toRow } from "@/lib/deliveries";
import { manilaDayEndUtc, manilaDayStartUtc } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

export async function GET(request: NextRequest) {
  try {
    await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const params = request.nextUrl.searchParams;
  const range = z.object({ start: dateString, end: dateString }).safeParse({
    start: params.get("start"),
    end: params.get("end"),
  });
  if (!range.success) return NextResponse.json({ error: "start and end dates are required" }, { status: 400 });
  const { start, end } = range.data;

  const prev = previousPeriod(start, end);
  const [receipts, previous] = await Promise.all([
    prisma.deliveryReceipt.findMany({
      where: { date: { gte: manilaDayStartUtc(start), lt: manilaDayEndUtc(end) } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.deliveryReceipt.aggregate({
      where: { date: { gte: manilaDayStartUtc(prev.start), lt: manilaDayEndUtc(prev.end) } },
      _sum: { amountCentavos: true },
    }),
  ]);

  return NextResponse.json({
    receipts: receipts.map(toRow),
    previousTotalCentavos: previous._sum.amountCentavos ?? 0,
  });
}

const createSchema = z.object({
  receiptName: z.string().trim().min(1, "Enter the receipt name (e.g. the supplier)").max(200),
  receiptNumber: z.string().trim().max(100).optional().or(z.literal("")),
  amountCentavos: z.number().int().min(1, "Amount must be greater than 0").max(1_000_000_000),
  date: dateString,
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid receipt" }, { status: 400 });
  }

  const receipt = await prisma.deliveryReceipt.create({
    data: {
      receiptName: parsed.data.receiptName,
      receiptNumber: parsed.data.receiptNumber || null,
      amountCentavos: parsed.data.amountCentavos,
      date: manilaDayStartUtc(parsed.data.date),
      note: parsed.data.note || null,
      createdByName: session.user.name ?? session.user.email ?? "Staff",
    },
  });
  return NextResponse.json({ receipt: toRow(receipt) }, { status: 201 });
}
