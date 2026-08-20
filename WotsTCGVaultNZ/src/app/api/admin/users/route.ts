import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-staff";

export async function GET(req: NextRequest) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const status = searchParams.get("status");

  const users = await prisma.user.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              { username: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { fullName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      isEmailVerified: true,
      isIdVerified: true,
      isFacebookLinked: true,
      isTrustedSeller: true,
      createdAt: true,
      _count: { select: { listings: true } },
    },
  });

  return NextResponse.json({ users });
}
