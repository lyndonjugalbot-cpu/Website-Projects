import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sweepInspectionPeriods, sweepStaleDeliveries } from "@/lib/payouts";
import { sweepExpiredReservations } from "@/lib/reservations";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Cheap, DB-only sweeps run inline on page load (same lazy-sweep pattern
  // as before). The Stripe-calling payout *release* sweep is deliberately
  // NOT run here — see /api/cron/release-payouts — so listing your orders
  // never has unpredictable Stripe-API latency.
  await Promise.all([sweepExpiredReservations(), sweepInspectionPeriods(), sweepStaleDeliveries()]);

  const { searchParams } = new URL(req.url);
  const as = searchParams.get("as") === "seller" ? "seller" : "buyer";

  const orders =
    as === "buyer"
      ? await prisma.order.findMany({
          where: { buyerId: session.user.id },
          orderBy: { createdAt: "desc" },
          include: {
            items: { include: { listing: { select: { slug: true, images: { take: 1 } } } } },
            payment: true,
            shipment: true,
            dispute: { select: { id: true, status: true, reason: true } },
          },
        })
      : await prisma.order.findMany({
          where: { items: { some: { sellerId: session.user.id } } },
          orderBy: { createdAt: "desc" },
          include: {
            items: { where: { sellerId: session.user.id }, include: { listing: { select: { slug: true, images: { take: 1 } } } } },
            payment: true,
            shipment: true,
            buyer: { select: { username: true, fullName: true } },
            dispute: { select: { id: true, status: true, reason: true } },
          },
        });

  return NextResponse.json({ orders });
}
