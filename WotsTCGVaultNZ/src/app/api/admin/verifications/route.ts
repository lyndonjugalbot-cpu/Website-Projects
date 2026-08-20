import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-staff";

export async function GET() {
  const guard = await requireStaff("verification.review");
  if (guard.response) return guard.response;

  const submissions = await prisma.identityVerification.findMany({
    orderBy: { submittedAt: "desc" },
    take: 100,
    include: { user: { select: { username: true, fullName: true, email: true } } },
  });

  return NextResponse.json({ submissions });
}
