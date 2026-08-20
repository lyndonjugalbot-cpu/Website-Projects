import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sellerEligibility } from "@/lib/rbac";
import { z } from "zod";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { facebookConnection: true, payoutAccount: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { passwordHash, twoFactorSecret, ...safe } = user;
  void passwordHash;
  void twoFactorSecret;

  return NextResponse.json({ user: safe, eligibility: sellerEligibility(user) });
}

const updateSchema = z.object({
  displayName: z.string().max(60).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(60).optional(),
  avatarUrl: z.string().url().optional(),
  sellerTermsAccepted: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { sellerTermsAccepted, ...rest } = parsed.data;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...rest,
      ...(sellerTermsAccepted ? { sellerTermsAt: new Date() } : {}),
    },
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
