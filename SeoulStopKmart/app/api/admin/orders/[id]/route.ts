// Single-order detail + update, backing the admin order detail page
// (app/admin/orders/[id]/page.tsx and components/admin/OrderStatusEditor.tsx).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOrderById, markOrderPaid } from "@/lib/orders";
import { requireRole, UnauthorizedError } from "@/lib/authz";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const order = await getOrderById(params.id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json({ order });
}

const GATEWAY_METHODS = new Set(["gcash", "paymaya", "card"]);

const patchSchema = z.object({
  orderStatus: z
    .enum(["PENDING", "CONFIRMED", "PREPARING", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"])
    .optional(),
  paymentStatus: z.enum(["PENDING", "PROCESSING", "PAID", "FAILED", "REFUNDED"]).optional(),
  internalNotes: z.string().max(2000).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const order = await getOrderById(params.id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { orderStatus, paymentStatus, internalNotes } = parsed.data;

  // Payment status for gateway methods (GCash/Maya/card) is only ever set
  // by verified PayMongo events (webhook / poll fallback) — never by a
  // staff click. Only COD/bank-transfer orders can be manually verified
  // here, since there's no gateway confirming those.
  if (paymentStatus && paymentStatus !== order.paymentStatus) {
    const isGatewayOrder = order.paymentMethod ? GATEWAY_METHODS.has(order.paymentMethod) : false;
    if (isGatewayOrder) {
      return NextResponse.json(
        { error: "Payment status for gateway payments (GCash/Maya/card) is set automatically and can't be edited." },
        { status: 400 }
      );
    }
  }

  // Marking a COD/bank-transfer order PAID goes through markOrderPaid so
  // stock is decremented exactly once, same as gateway payments.
  if (paymentStatus === "PAID" && order.paymentStatus !== "PAID") {
    await markOrderPaid(order.id);
  }

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: {
      ...(orderStatus ? { orderStatus } : {}),
      ...(paymentStatus && paymentStatus !== "PAID" ? { paymentStatus } : {}),
      ...(internalNotes !== undefined ? { internalNotes } : {}),
      lastUpdatedByName: session.user.name ?? session.user.email ?? undefined,
    },
    include: { items: true },
  });

  return NextResponse.json({ order: updated });
}
