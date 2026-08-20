import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-staff";

export async function GET(req: NextRequest) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const listings = await prisma.listing.findMany({
    where: status ? { status: status as never } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      images: { take: 1, orderBy: { position: "asc" } },
      seller: { select: { username: true, fullName: true, isTrustedSeller: true } },
    },
  });

  return NextResponse.json({ listings });
}
