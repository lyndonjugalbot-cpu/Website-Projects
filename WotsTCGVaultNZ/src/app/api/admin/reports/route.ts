import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-staff";

export async function GET(req: NextRequest) {
  const guard = await requireStaff("report.review");
  if (guard.response) return guard.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "OPEN";

  const reports = await prisma.report.findMany({
    where: { status: status as never },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      reporter: { select: { username: true } },
      reportedUser: { select: { username: true, status: true } },
      listing: { select: { title: true, slug: true, status: true } },
    },
  });

  return NextResponse.json({ reports });
}
