import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-staff";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  status: z.enum(["UNDER_REVIEW", "ACTIONED", "DISMISSED"]),
  resolutionNotes: z.string().max(1000).optional(),
});

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const guard = await requireStaff("report.review");
  if (guard.response) return guard.response;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await prisma.report.update({
    where: { id },
    data: {
      status: parsed.data.status,
      resolutionNotes: parsed.data.resolutionNotes,
      resolvedBy: guard.session!.user.id,
      resolvedAt: new Date(),
    },
  });

  await logAudit({
    actorId: guard.session!.user.id,
    action: "report.resolve",
    targetType: "Report",
    targetId: id,
    metadata: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
