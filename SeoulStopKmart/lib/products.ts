// Read-only product queries used by the public storefront (home page,
// /products listing, product detail page). Deliberately never selects
// cost/supplier/barcode — those are admin-only and should never reach a
// public API response. Admin CRUD lives separately in
// app/api/admin/products/*.
import { prisma } from "@/lib/prisma";
import { isPurchasable } from "@/lib/types";
import type { ProductCategory, ProductStatus, ProductView } from "@/lib/types";

// Trimmed-down shape of a Prisma Product row, enough to build a ProductView.
type PrismaProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCentavos: number;
  salePriceCentavos: number | null;
  imageUrl: string;
  stock: number;
  category: string;
  status: string;
  isFeatured: boolean;
  isBestSeller: boolean;
};

// Converts a raw Prisma row into the plain ProductView type components use.
function toProductView(p: PrismaProductRow): ProductView {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    priceCentavos: p.priceCentavos,
    salePriceCentavos: p.salePriceCentavos,
    imageUrl: p.imageUrl,
    stock: p.stock,
    category: p.category as ProductCategory,
    status: p.status as ProductStatus,
    isFeatured: p.isFeatured,
    isBestSeller: p.isBestSeller,
  };
}

export type ProductSort = "newest" | "price-asc" | "price-desc" | "name-asc";

export type ProductFilters = {
  search?: string;
  category?: ProductCategory;
  sort?: ProductSort;
};

const SORT_TO_ORDER_BY: Record<ProductSort, Record<string, "asc" | "desc">> = {
  newest: { createdAt: "desc" },
  "price-asc": { priceCentavos: "asc" },
  "price-desc": { priceCentavos: "desc" },
  "name-asc": { name: "asc" },
};

/** Storefront-facing product listing — excludes INACTIVE products entirely.
 *  In-stock products come first and out-of-stock ones sink to the bottom; the
 *  chosen sort still applies within each group. */
export async function getAllProducts(filters: ProductFilters = {}): Promise<ProductView[]> {
  const products = await prisma.product.findMany({
    where: {
      status: { not: "INACTIVE" },
      posOnly: false,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { description: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: SORT_TO_ORDER_BY[filters.sort ?? "newest"],
  });
  const views = products.map(toProductView);
  return [...views.filter(isPurchasable), ...views.filter((p) => !isPurchasable(p))];
}

/** Products flagged "Featured" by an admin — shown in their own section on the home page. */
export async function getFeaturedProducts(limit = 4): Promise<ProductView[]> {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", posOnly: false, isFeatured: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return products.map(toProductView);
}

/** Products flagged "Best seller" by an admin — shown in their own section on the home page. */
export async function getBestSellerProducts(limit = 4): Promise<ProductView[]> {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", posOnly: false, isBestSeller: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return products.map(toProductView);
}

/** Looks up one product for the /products/[slug] detail page. Hides INACTIVE products (404s them). */
export async function getProductBySlug(slug: string): Promise<ProductView | null> {
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product || product.status === "INACTIVE" || product.posOnly) return null;
  return toProductView(product);
}
