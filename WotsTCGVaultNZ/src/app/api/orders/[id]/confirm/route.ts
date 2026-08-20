import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startInspectionPeriod } from "@/lib/payouts";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Buyer confirms delivery. This does NOT release payout immediately — it
 * starts the buyer protection / inspection period (default 48h,
 * admin-configurable). The payout becomes eligible only once that window
 * elapses with no dispute — see lib/payouts.ts sweepInspectionPeriods.
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.buyerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["AWAITING_SHIPMENT", "SHIPPED", "IN_TRANSIT"].includes(order.status)) {
    return NextResponse.json({ error: "This order cannot be confirmed right now." }, { status: 400 });
  }

  const deliveredAt = new Date();
  await prisma.shippingRecord.updateMany({
    where: { orderId: id },
    data: { status: "DELIVERED", deliveredAt },
  });
  await startInspectionPeriod(id, deliveredAt);

  return NextResponse.json({ ok: true });
}
