import { prisma } from "@/lib/prisma";
import type { ProductCategory, ProductStatus, ProductView } from "@/lib/types";

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

/** Storefront-facing product listing — excludes INACTIVE products entirely. */
export async function getAllProducts(filters: ProductFilters = {}): Promise<ProductView[]> {
  const products = await prisma.product.findMany({
    where: {
      status: { not: "INACTIVE" },
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
  return products.map(toProductView);
}

export async function getFeaturedProducts(limit = 4): Promise<ProductView[]> {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", isFeatured: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return products.map(toProductView);
}

export async function getBestSellerProducts(limit = 4): Promise<ProductView[]> {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", isBestSeller: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return products.map(toProductView);
}

export async function getProductBySlug(slug: string): Promise<ProductView | null> {
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product || product.status === "INACTIVE") return null;
  return toProductView(product);
}
