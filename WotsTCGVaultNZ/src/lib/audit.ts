import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Every admin/moderator mutation (bans, listing removal, verification
 * decisions, refunds, dispute resolutions) must call this so the platform
 * has a durable audit trail, per the security requirements.
 */
export async function logAudit(entry: {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress ?? undefined,
    },
  });
}
