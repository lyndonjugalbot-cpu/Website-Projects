import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, isStaff } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const isOwner = listing.sellerId === session.user.id;
  const staffOverride = isStaff(session.user.role as never) && can(session.user.role as never, "listing.edit.any");
  if (!isOwner && !staffOverride) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const allowed: Record<string, unknown> = {};

  if (isOwner) {
    // Sellers may pause/resume their own listing or mark it sold, but any
    // edit to price/content should be reviewed again before going live.
    if (body.status && ["PAUSED", "ACTIVE", "SOLD", "DRAFT"].includes(body.status)) {
      if (body.status === "ACTIVE" && listing.status === "REJECTED") {
        return NextResponse.json({ error: "Rejected listings must be resubmitted." }, { status: 400 });
      }
      allowed.status = body.status;
      if (body.status === "SOLD") allowed.soldAt = new Date();
    }
    if (typeof body.priceCents === "number" && body.priceCents >= 100) {
      allowed.priceCents = body.priceCents;
    }
    if (typeof body.quantity === "number" && body.quantity >= 0) {
      allowed.quantity = body.quantity;
    }
  }

  if (staffOverride) {
    if (body.status && ["ACTIVE", "REJECTED", "REMOVED", "PENDING_REVIEW"].includes(body.status)) {
      allowed.status = body.status;
      if (body.status === "ACTIVE") allowed.publishedAt = new Date();
      if (body.rejectionNote) allowed.rejectionNote = body.rejectionNote;
    }
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const updated = await prisma.listing.update({ where: { id }, data: allowed });

  await logAudit({
    actorId: session.user.id,
    action: staffOverride ? "listing.moderate" : "listing.update",
    targetType: "Listing",
    targetId: id,
    metadata: allowed as never,
  });

  return NextResponse.json({ ok: true, listing: updated });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const isOwner = listing.sellerId === session.user.id;
  const staffOverride = isStaff(session.user.role as never) && can(session.user.role as never, "listing.remove");
  if (!isOwner && !staffOverride) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.listing.update({ where: { id }, data: { deletedAt: new Date(), status: "REMOVED" } });

  await logAudit({
    actorId: session.user.id,
    action: isOwner ? "listing.delete" : "listing.moderate.remove",
    targetType: "Listing",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
