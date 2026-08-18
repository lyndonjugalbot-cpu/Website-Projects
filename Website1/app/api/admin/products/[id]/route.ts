// View, edit, and delete a single product — backs the admin product edit
// page and the delete button on the product list.
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
  costCentavos: z.number().int().min(0).nullable().optional(),
  supplier: z.string().trim().max(200).nullable().optional(),
  barcode: z.string().trim().max(100).nullable().optional(),
  imageUrl: z.string().trim().min(1),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).optional(),
  allowOversell: z.boolean().optional(),
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

  // Manual stock edits here would bypass the ledger — stock changes on
  // existing products go through /admin/inventory (recordStockMovement)
  // instead, so every change is traceable. This endpoint updates catalog
  // fields only.
  const { stock: _ignoredStock, ...catalogData } = data;
  void _ignoredStock;

  try {
    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...catalogData,
        salePriceCentavos: data.salePriceCentavos ?? null,
        costCentavos: data.costCentavos ?? null,
        supplier: data.supplier || null,
        barcode: data.barcode || null,
      },
    });
    return NextResponse.json({ product });
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Another product already uses this barcode" }, { status: 400 });
    }
    throw err;
  }
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
