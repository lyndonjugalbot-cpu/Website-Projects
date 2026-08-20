import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-staff";

export async function GET() {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const [userCount, sellerCount, activeListings, pendingListings, pendingVerifications, openReports, openDisputes, revenueAgg, orderCounts] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "SELLER" } }),
      prisma.listing.count({ where: { status: "ACTIVE" } }),
      prisma.listing.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.identityVerification.count({ where: { status: "PENDING" } }),
      prisma.report.count({ where: { status: "OPEN" } }),
      prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      prisma.order.aggregate({ where: { status: "COMPLETED" }, _sum: { platformFeeCents: true, totalCents: true } }),
      prisma.order.groupBy({ by: ["status"], _count: { status: true } }),
    ]);

  return NextResponse.json({
    userCount,
    sellerCount,
    activeListings,
    pendingListings,
    pendingVerifications,
    openReports,
    openDisputes,
    platformRevenueCents: revenueAgg._sum.platformFeeCents ?? 0,
    grossVolumeCents: revenueAgg._sum.totalCents ?? 0,
    orderCounts: Object.fromEntries(orderCounts.map((o) => [o.status, o._count.status])),
  });
}
