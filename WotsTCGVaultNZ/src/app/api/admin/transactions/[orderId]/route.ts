import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-staff";

type RouteContext = { params: Promise<{ orderId: string }> };

/**
 * Complete admin transaction view for one order: buyer, seller, every
 * Stripe object we know about (Checkout Session, PaymentIntent, Charge,
 * Transfer, Payout), refunds, dispute, shipment, and the audit trail.
 */
export async function GET(_req: Request, { params }: RouteContext) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      buyer: { select: { id: true, username: true, fullName: true, email: true } },
      items: {
        include: {
          listing: { select: { title: true, slug: true } },
        },
      },
      payment: true,
      shipment: true,
      refunds: { orderBy: { createdAt: "desc" } },
      dispute: { include: { evidence: true } },
      transfers: true,
      reservation: true,
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const sellerIds = Array.from(new Set(order.items.map((i) => i.sellerId)));
  const [sellers, payouts] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, username: true, fullName: true, email: true } }),
    prisma.payout.findMany({ where: { orderItemIds: { hasSome: order.items.map((i) => i.id) } }, include: { transfer: true } }),
  ]);

  const relatedTargetIds = [orderId, order.dispute?.id, ...payouts.map((p) => p.id)].filter((v): v is string => Boolean(v));
  const auditLogs = await prisma.auditLog.findMany({
    where: { targetId: { in: relatedTargetIds } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { username: true } } },
  });

  return NextResponse.json({ order, sellers, payouts, auditLogs });
}
