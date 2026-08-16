import Link from "next/link";
import { formatCentavosAsPHP } from "@/lib/money";
import type { ProductView } from "@/lib/types";
import { effectivePrice, isPurchasable } from "@/lib/types";
import { AddToCartButton } from "@/components/AddToCartButton";

export function ProductCard({ product }: { product: ProductView }) {
  const onSale = product.salePriceCentavos !== null;
  const purchasable = isPurchasable(product);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden bg-neutral-100">
        {/* Seed images are locally-generated SVG placeholders (see prisma/seed.ts) —
            a plain <img> avoids next/image's SVG-optimization restrictions. */}
        <img
          src={product.imageUrl}
          alt={product.name}
          width={600}
          height={600}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        {onSale && (
          <span className="absolute left-2 top-2 rounded-full bg-brand-red px-2.5 py-1 text-xs font-semibold text-white">
            Sale
          </span>
        )}
        {!purchasable && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-medium text-neutral-600">
            Out of stock
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/products/${product.slug}`}>
          <h3 className="font-medium text-neutral-900">{product.name}</h3>
        </Link>
        <div className="flex items-baseline gap-1.5">
          <p className="text-sm font-semibold text-neutral-900">{formatCentavosAsPHP(effectivePrice(product))}</p>
          {onSale && (
            <p className="text-xs text-neutral-400 line-through">{formatCentavosAsPHP(product.priceCentavos)}</p>
          )}
        </div>
        {purchasable && product.stock <= 5 && (
          <p className="text-xs text-amber-600">Only {product.stock} left</p>
        )}
        <div className="mt-auto pt-2">
          <AddToCartButton product={product} />
        </div>
      </div>
    </div>
  );
}
