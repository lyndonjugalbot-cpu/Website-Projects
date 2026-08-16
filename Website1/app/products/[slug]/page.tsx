import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlug } from "@/lib/products";
import { formatCentavosAsPHP } from "@/lib/money";
import { ProductPurchasePanel } from "@/components/ProductPurchasePanel";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug(params.slug);
  return { title: product ? `${product.name} — ShopEasePH` : "Product not found" };
}

export default async function ProductDetailPage({ params }: Props) {
  const product = await getProductBySlug(params.slug);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/products" className="text-sm text-neutral-500 hover:text-neutral-800">
        &larr; Back to shop
      </Link>

      <div className="mt-6 grid grid-cols-1 gap-10 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-2xl bg-neutral-100">
          <img
            src={product.imageUrl}
            alt={product.name}
            width={600}
            height={600}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{product.name}</h1>
          <p className="text-xl font-semibold text-neutral-900">
            {formatCentavosAsPHP(product.priceCentavos)}
          </p>
          <p className="leading-relaxed text-neutral-600">{product.description}</p>
          <p className="text-sm text-neutral-500">
            {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
          </p>

          <div className="mt-2">
            <ProductPurchasePanel product={product} />
          </div>
        </div>
      </div>
    </div>
  );
}
