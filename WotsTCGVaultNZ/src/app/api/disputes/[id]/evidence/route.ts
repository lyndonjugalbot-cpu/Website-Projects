import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDisputeEvidence } from "@/lib/disputes";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({ url: z.string().url(), note: z.string().max(500).optional() });

/** Buyer or seller on the dispute uploads supporting evidence (photos, etc). Reuses the listing-image upload flow for the actual file. */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dispute = await prisma.dispute.findUnique({ where: { id }, include: { order: { include: { items: true } } } });
  if (!dispute) return NextResponse.json({ error: "Dispute not found." }, { status: 404 });

  const isBuyer = dispute.filedById === session.user.id;
  const isSeller = dispute.order.items.some((i) => i.sellerId === session.user.id);
  if (!isBuyer && !isSeller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await addDisputeEvidence({ disputeId: id, uploadedBy: session.user.id, url: parsed.data.url, note: parsed.data.note });
  return NextResponse.json({ ok: true });
}
