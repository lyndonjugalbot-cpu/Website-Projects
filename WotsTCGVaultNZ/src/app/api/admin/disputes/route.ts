import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-staff";

export async function GET() {
  const guard = await requireStaff("dispute.manage");
  if (guard.response) return guard.response;

  const disputes = await prisma.dispute.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      order: { select: { id: true, totalCents: true, status: true, items: { select: { sellerId: true } } } },
      filedBy: { select: { username: true } },
      evidence: true,
    },
  });

  return NextResponse.json({ disputes });
}
