import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [payouts, payoutAccount] = await Promise.all([
    prisma.payout.findMany({ where: { sellerId: session.user.id }, orderBy: { createdAt: "desc" } }),
    prisma.sellerPayoutAccount.findUnique({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({ payouts, payoutAccount });
}
