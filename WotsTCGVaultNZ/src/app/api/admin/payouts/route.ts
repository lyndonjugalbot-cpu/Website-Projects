import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-staff";

export async function GET(req: NextRequest) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const payouts = await prisma.payout.findMany({
    where: status ? { status: status as never } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      seller: { select: { username: true, fullName: true } },
      transfer: true,
    },
  });

  return NextResponse.json({ payouts });
}
