import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";

/**
 * Minimal, POS-scale product list for client-side search/barcode lookup —
 * intentionally excludes cost/supplier (no reason for the register screen
 * to hold cost data in the browser). Fine to fetch in full at demo/small-
 * catalog scale; swap for a server-side search endpoint if the catalog
 * grows large enough that this becomes slow.
 */
export async function GET() {
  try {
    await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const products = await prisma.product.findMany({
    where: { status: { not: "INACTIVE" } },
    select: {
      id: true,
      name: true,
      slug: true,
      barcode: true,
      priceCentavos: true,
      salePriceCentavos: true,
      imageUrl: true,
      stock: true,
      status: true,
      category: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ products });
}
