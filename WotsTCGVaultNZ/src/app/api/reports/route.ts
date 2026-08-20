import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportSchema } from "@/lib/validations/order";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = rateLimit(`report:${session.user.id}:${clientIp(req.headers)}`, 10, 60 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many reports submitted recently." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  if (!data.listingId && !data.reportedUserId) {
    return NextResponse.json({ error: "A report must target a listing or a user." }, { status: 400 });
  }

  const report = await prisma.report.create({
    data: {
      reporterId: session.user.id,
      listingId: data.listingId,
      reportedUserId: data.reportedUserId,
      reason: data.reason,
      details: data.details,
    },
  });

  return NextResponse.json({ ok: true, reportId: report.id });
}
