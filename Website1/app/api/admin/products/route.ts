import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { uniqueProductSlug } from "@/lib/slug";
import { ALL_CATEGORIES } from "@/lib/types";
import type { ProductCategory } from "@/lib/types";

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

const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(2000),
  priceCentavos: z.number().int().min(1, "Price must be greater than 0"),
  salePriceCentavos: z.number().int().min(1).nullable().optional(),
  imageUrl: z.string().trim().min(1, "Image is required"),
  stock: z.number().int().min(0),
  category: z.enum(ALL_CATEGORIES as [ProductCategory, ...ProductCategory[]]),
  status: z.enum(["ACTIVE", "INACTIVE", "OUT_OF_STOCK"]),
  isFeatured: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireRole("MANAGER");
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

  const product = await prisma.product.create({
    data: {
      ...data,
      salePriceCentavos: data.salePriceCentavos ?? null,
      slug,
    },
  });

  return NextResponse.json({ product }, { status: 201 });
}
