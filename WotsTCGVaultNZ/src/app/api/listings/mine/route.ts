import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listings = await prisma.listing.findMany({
    where: { sellerId: session.user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { images: { take: 1, orderBy: { position: "asc" } } },
  });

  return NextResponse.json({ listings });
}
