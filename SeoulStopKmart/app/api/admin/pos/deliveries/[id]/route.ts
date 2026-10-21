// Edit or delete a delivery receipt — manager/owner only, so staff can log
// receipts but can't quietly rewrite what was recorded.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { manilaDayStartUtc } from "@/lib/timezone";
import { toRow } from "@/lib/deliveries";

const patchSchema = z.object({
  receiptName: z.string().trim().min(1).max(200).optional(),
  receiptNumber: z.string().trim().max(100).nullable().optional(),
  amountCentavos: z.number().int().min(1).max(1_000_000_000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

async function guard() {
  try {
    await requireRole("MANAGER");
    return null;
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await guard();
  if (denied) return denied;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const receipt = await prisma.deliveryReceipt.update({
      where: { id: params.id },
      data: {
        ...(d.receiptName !== undefined ? { receiptName: d.receiptName } : {}),
        ...(d.receiptNumber !== undefined ? { receiptNumber: d.receiptNumber || null } : {}),
        ...(d.amountCentavos !== undefined ? { amountCentavos: d.amountCentavos } : {}),
        ...(d.date !== undefined ? { date: manilaDayStartUtc(d.date) } : {}),
        ...(d.note !== undefined ? { note: d.note || null } : {}),
      },
    });
    return NextResponse.json({ receipt: toRow(receipt) });
  } catch {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await guard();
  if (denied) return denied;
  const { count } = await prisma.deliveryReceipt.deleteMany({ where: { id: params.id } });
  if (count === 0) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
