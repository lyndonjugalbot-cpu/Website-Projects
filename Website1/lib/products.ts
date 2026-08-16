import { prisma } from "@/lib/prisma";
import type { ProductView } from "@/lib/types";

function toProductView(p: {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCentavos: number;
  imageUrl: string;
  stock: number;
}): ProductView {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    priceCentavos: p.priceCentavos,
    imageUrl: p.imageUrl,
    stock: p.stock,
  };
}

export async function getAllProducts(): Promise<ProductView[]> {
  const products = await prisma.product.findMany({ orderBy: { createdAt: "asc" } });
  return products.map(toProductView);
}

export async function getFeaturedProducts(limit = 4): Promise<ProductView[]> {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  return products.map(toProductView);
}

export async function getProductBySlug(slug: string): Promise<ProductView | null> {
  const product = await prisma.product.findUnique({ where: { slug } });
  return product ? toProductView(product) : null;
}
