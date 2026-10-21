// Edit, pay, un-pay or delete one bill — manager/owner only.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { addOneMonth } from "@/lib/bills";
import { MAX_REMINDER_DAYS, toBillRow } from "@/lib/bills-server";
import { manilaDateOf } from "@/lib/deliveries";
import { manilaDayStartUtc, todayInManila } from "@/lib/timezone";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  amountCentavos: z.number().int().min(1).max(1_000_000_000).optional(),
  dueDate: dateString.optional(),
  recurrence: z.enum(["NONE", "MONTHLY"]).optional(),
  reminderDaysBefore: z.number().int().min(0).max(MAX_REMINDER_DAYS).optional(),
  note: z.string().trim().max(500).nullable().optional(),
  // Payment actions. `markPaid` records what was actually paid and when.
  markPaid: z.boolean().optional(),
  paidAmountCentavos: z.number().int().min(0).max(1_000_000_000).optional(),
  paidDate: dateString.optional(),
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
  const d = parsed.data;
  const actor = session.user.name ?? session.user.email ?? "Manager";

  const existing = await prisma.bill.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  const payment =
    d.markPaid === true
      ? {
          isPaid: true,
          paidAt: manilaDayStartUtc(d.paidDate ?? todayInManila()),
          paidAmountCentavos: d.paidAmountCentavos ?? existing.amountCentavos,
          paidByName: actor,
        }
      : d.markPaid === false
        ? { isPaid: false, paidAt: null, paidAmountCentavos: null, paidByName: null }
        : {};

  const bill = await prisma.$transaction(async (tx) => {
    const updated = await tx.bill.update({
      where: { id: params.id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.amountCentavos !== undefined ? { amountCentavos: d.amountCentavos } : {}),
        ...(d.dueDate !== undefined ? { dueDate: manilaDayStartUtc(d.dueDate) } : {}),
        ...(d.recurrence !== undefined ? { recurrence: d.recurrence } : {}),
        ...(d.reminderDaysBefore !== undefined ? { reminderDaysBefore: d.reminderDaysBefore } : {}),
        ...(d.note !== undefined ? { note: d.note || null } : {}),
        ...payment,
      },
    });

    // Paying a monthly bill queues up next month's — unless it already exists.
    if (d.markPaid === true && !existing.isPaid && updated.recurrence === "MONTHLY") {
      const nextDue = manilaDayStartUtc(addOneMonth(manilaDateOf(updated.dueDate)));
      const already = await tx.bill.findFirst({ where: { name: updated.name, dueDate: nextDue } });
      if (!already) {
        await tx.bill.create({
          data: {
            name: updated.name,
            amountCentavos: updated.amountCentavos,
            dueDate: nextDue,
            recurrence: "MONTHLY",
            reminderDaysBefore: updated.reminderDaysBefore,
            note: updated.note,
            createdByName: actor,
          },
        });
      }
    }
    return updated;
  });

  return NextResponse.json({ bill: toBillRow(bill) });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const { count } = await prisma.bill.deleteMany({ where: { id: params.id } });
  if (count === 0) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
