import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { ALL_CATEGORIES } from "@/lib/types";
import type { ProductCategory } from "@/lib/types";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json({ product });
}

const productUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  priceCentavos: z.number().int().min(1),
  salePriceCentavos: z.number().int().min(1).nullable().optional(),
  imageUrl: z.string().trim().min(1),
  stock: z.number().int().min(0),
  category: z.enum(ALL_CATEGORIES as [ProductCategory, ...ProductCategory[]]),
  status: z.enum(["ACTIVE", "INACTIVE", "OUT_OF_STOCK"]),
  isFeatured: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = productUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid product" }, { status: 400 });
  }

  const data = parsed.data;
  if (data.salePriceCentavos && data.salePriceCentavos >= data.priceCentavos) {
    return NextResponse.json({ error: "Sale price must be lower than the regular price" }, { status: 400 });
  }

  const existing = await prisma.product.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const product = await prisma.product.update({
    where: { id: params.id },
    data: { ...data, salePriceCentavos: data.salePriceCentavos ?? null },
  });

  return NextResponse.json({ product });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const existing = await prisma.product.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Products referenced by existing order items are deactivated instead of
  // hard-deleted, so past orders keep their (snapshotted) history intact —
  // OrderItem.productId is a nullable SetNull relation for exactly this case.
  const hasOrders = await prisma.orderItem.findFirst({ where: { productId: params.id } });
  if (hasOrders) {
    await prisma.product.update({ where: { id: params.id }, data: { status: "INACTIVE" } });
    return NextResponse.json({ deactivated: true });
  }

  await prisma.product.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}
