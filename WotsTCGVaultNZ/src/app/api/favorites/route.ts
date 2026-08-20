import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listingCardSelect } from "@/lib/queries";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { listing: { select: listingCardSelect } },
  });

  const listings = favorites.map((f) => ({ ...f.listing, isFavorited: true }));
  return NextResponse.json({ listings });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listingId } = await req.json().catch(() => ({ listingId: null }));
  if (!listingId) return NextResponse.json({ error: "Missing listingId" }, { status: 400 });

  await prisma.$transaction([
    prisma.favorite.upsert({
      where: { userId_listingId: { userId: session.user.id, listingId } },
      update: {},
      create: { userId: session.user.id, listingId },
    }),
    prisma.listing.update({ where: { id: listingId }, data: { favoriteCount: { increment: 1 } } }),
  ]).catch(() => null); // idempotent: ignore if already favorited

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listingId } = await req.json().catch(() => ({ listingId: null }));
  if (!listingId) return NextResponse.json({ error: "Missing listingId" }, { status: 400 });

  const existing = await prisma.favorite.findUnique({
    where: { userId_listingId: { userId: session.user.id, listingId } },
  });
  if (existing) {
    await prisma.$transaction([
      prisma.favorite.delete({ where: { id: existing.id } }),
      prisma.listing.update({ where: { id: listingId }, data: { favoriteCount: { decrement: 1 } } }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
