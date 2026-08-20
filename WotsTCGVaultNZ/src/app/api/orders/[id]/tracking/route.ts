import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackingSchema } from "@/lib/validations/order";
import { notifyUser } from "@/lib/notify";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Seller enters carrier + tracking number and marks the order shipped.
 * Marking an order shipped does NOT release any payout — see
 * lib/payouts.ts. Payout eligibility only starts once delivery is
 * separately confirmed (tracking-carrier delivery scan integration,
 * buyer confirmation, or admin override).
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true, buyer: true } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const isSeller = order.items.some((i) => i.sellerId === session.user.id);
  if (!isSeller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (order.status !== "AWAITING_SHIPMENT") {
    return NextResponse.json({ error: "This order cannot be shipped in its current state." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = trackingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  await prisma.$transaction([
    prisma.shippingRecord.update({
      where: { orderId: id },
      data: {
        carrier: data.carrier,
        trackingNumber: data.trackingNumber,
        trackingUrl: data.trackingUrl || undefined,
        hasInsurance: data.hasInsurance,
        status: "IN_TRANSIT",
        shippedAt: new Date(),
      },
    }),
    prisma.order.update({ where: { id }, data: { status: "SHIPPED" } }),
  ]);

  await notifyUser({
    userId: order.buyerId,
    type: "ORDER_UPDATE",
    title: "Your order has shipped",
    body: `Your order shipped via ${data.carrier}. Tracking number: ${data.trackingNumber}.`,
    link: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/buyer`,
    email: { to: order.buyer.email, name: order.buyer.fullName },
  });

  return NextResponse.json({ ok: true });
}
