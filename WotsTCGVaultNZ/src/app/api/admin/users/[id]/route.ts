import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-staff";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { isAdmin } from "@/lib/rbac";
import type { Role } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "BANNED", "DEACTIVATED"]).optional(),
  bannedReason: z.string().max(500).optional(),
  role: z.enum(["BUYER", "SELLER", "MODERATOR", "VERIFICATION_REVIEWER", "SUPPORT", "SUPER_ADMIN"]).optional(),
  isTrustedSeller: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const guard = await requireStaff("users.ban");
  if (guard.response) return guard.response;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Only a super admin may grant/change staff roles.
  if (parsed.data.role && !isAdmin(guard.session!.user.role as Role)) {
    return NextResponse.json({ error: "Only a super admin can change roles." }, { status: 403 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "BANNED" || parsed.data.status === "SUSPENDED") {
    data.bannedAt = new Date();
  }

  const user = await prisma.user.update({ where: { id }, data });

  await logAudit({
    actorId: guard.session!.user.id,
    action: "user.moderate",
    targetType: "User",
    targetId: id,
    metadata: parsed.data,
  });

  return NextResponse.json({ ok: true, user: { id: user.id, status: user.status, role: user.role } });
}
