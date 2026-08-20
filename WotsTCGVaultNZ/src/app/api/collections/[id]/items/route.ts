import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const itemSchema = z.object({
  name: z.string().min(1).max(120),
  setName: z.string().max(120).optional(),
  category: z.enum([
    "SINGLE_CARD",
    "GRADED_SLAB",
    "SEALED_PRODUCT",
    "BOOSTER_BOX",
    "BOOSTER_PACK",
    "ELITE_TRAINER_BOX",
    "COLLECTION",
    "ACCESSORIES",
    "OTHER",
  ]),
  condition: z
    .enum(["MINT", "NEAR_MINT", "EXCELLENT", "GOOD", "PLAYED", "HEAVILY_PLAYED", "DAMAGED"])
    .optional(),
  images: z.array(z.string().url()).default([]),
  gradingCompany: z.enum(["PSA", "BGS", "CGC", "ACE", "OTHER"]).optional(),
  grade: z.string().max(20).optional(),
  estimatedValueCents: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional(),
  isPublic: z.boolean().default(true),
});

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const collection = await prisma.collection.findUnique({ where: { id } });
  if (!collection || collection.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const item = await prisma.collectionItem.create({ data: { collectionId: id, ...parsed.data } });
  return NextResponse.json({ ok: true, item });
}
