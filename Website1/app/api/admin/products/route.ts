// Product list (GET) and create (POST) for the admin Products page. Editing
// and deleting a specific product live in app/api/admin/products/[id]/route.ts.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { uniqueProductSlug } from "@/lib/slug";
import { ALL_CATEGORIES } from "@/lib/types";
import type { ProductCategory } from "@/lib/types";
import { recordStockMovement } from "@/lib/inventory";

// Full product list, including INACTIVE ones — the public storefront query
// in lib/products.ts is separate and always hides those.
export async function GET() {
  try {
    await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ products });
}

// Validates the "add product" form (components/admin/ProductForm.tsx).
const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(2000),
  priceCentavos: z.number().int().min(1, "Price must be greater than 0"),
  salePriceCentavos: z.number().int().min(1).nullable().optional(),
  costCentavos: z.number().int().min(0).nullable().optional(),
  supplier: z.string().trim().max(200).nullable().optional(),
  barcode: z.string().trim().max(100).nullable().optional(),
  imageUrl: z.string().trim().min(1, "Image is required"),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).optional(),
  allowOversell: z.boolean().optional(),
  category: z.enum(ALL_CATEGORIES as [ProductCategory, ...ProductCategory[]]),
  status: z.enum(["ACTIVE", "INACTIVE", "OUT_OF_STOCK"]),
  isFeatured: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid product" }, { status: 400 });
  }

  const data = parsed.data;
  if (data.salePriceCentavos && data.salePriceCentavos >= data.priceCentavos) {
    return NextResponse.json({ error: "Sale price must be lower than the regular price" }, { status: 400 });
  }

  const slug = await uniqueProductSlug(data.name);

  // Product creation + its initial stock ledger entry happen in one
  // transaction, so a crash partway through can't leave a product with
  // stock but no matching StockMovement row.
  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...data,
          stock: 0, // set via recordStockMovement below, so it's ledger-traceable from day one
          salePriceCentavos: data.salePriceCentavos ?? null,
          costCentavos: data.costCentavos ?? null,
          supplier: data.supplier || null,
          barcode: data.barcode || null,
          slug,
        },
      });
      if (data.stock > 0) {
        await recordStockMovement(tx, {
          productId: created.id,
          quantityChange: data.stock,
          type: "RESTOCK",
          userName: session.user.name ?? session.user.email ?? "Staff",
          note: "Initial stock on product creation",
        });
      }
      return tx.product.findUniqueOrThrow({ where: { id: created.id } });
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    // P2002 = Prisma's unique-constraint-violation code — here that means
    // the barcode is already used by another product.
    if (err instanceof Error && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Another product already uses this barcode" }, { status: 400 });
    }
    throw err;
  }
}
