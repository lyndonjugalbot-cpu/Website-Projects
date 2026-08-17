import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { recordStockMovement } from "@/lib/inventory";

export async function GET(request: NextRequest) {
  try {
    await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const { searchParams } = request.nextUrl;
  const productId = searchParams.get("productId") ?? undefined;
  const type = searchParams.get("type") ?? undefined;

  const movements = await prisma.stockMovement.findMany({
    where: {
      ...(productId ? { productId } : {}),
      ...(type ? { type: type as never } : {}),
    },
    include: { product: { select: { name: true, imageUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ movements });
}

const adjustSchema = z.object({
  productId: z.string().min(1),
  newStock: z.number().int().min(0, "Stock can't be negative"),
  reason: z.string().trim().min(1, "A reason is required").max(500),
});

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = adjustSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid adjustment" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const delta = parsed.data.newStock - product.stock;
  if (delta === 0) {
    return NextResponse.json({ error: "New quantity is the same as current stock" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await recordStockMovement(tx, {
      productId: product.id,
      quantityChange: delta,
      type: "MANUAL_ADJUSTMENT",
      userName: session.user.name ?? session.user.email ?? "Staff",
      note: parsed.data.reason,
    });
  });

  return NextResponse.json({ ok: true });
}
