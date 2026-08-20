import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const follows = await prisma.favoriteSeller.findMany({
    where: { followerId: session.user.id },
    include: {
      seller: {
        select: {
          username: true,
          displayName: true,
          fullName: true,
          avatarUrl: true,
          isIdVerified: true,
          isTrustedSeller: true,
          _count: { select: { listings: { where: { status: "ACTIVE" } } } },
        },
      },
    },
  });

  return NextResponse.json({ sellers: follows.map((f) => f.seller) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sellerId } = await req.json().catch(() => ({ sellerId: null }));
  if (!sellerId || sellerId === session.user.id) {
    return NextResponse.json({ error: "Invalid seller." }, { status: 400 });
  }
  await prisma.favoriteSeller.upsert({
    where: { followerId_sellerId: { followerId: session.user.id, sellerId } },
    update: {},
    create: { followerId: session.user.id, sellerId },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sellerId } = await req.json().catch(() => ({ sellerId: null }));
  if (!sellerId) return NextResponse.json({ error: "Missing sellerId" }, { status: 400 });
  await prisma.favoriteSeller
    .delete({ where: { followerId_sellerId: { followerId: session.user.id, sellerId } } })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}
