import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-staff";

export async function GET(req: NextRequest) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const orders = await prisma.order.findMany({
    where: status ? { status: status as never } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      buyer: { select: { username: true, email: true } },
      items: { select: { titleSnapshot: true, sellerId: true, priceCents: true, quantity: true } },
      payment: true,
    },
  });

  return NextResponse.json({ orders });
}
