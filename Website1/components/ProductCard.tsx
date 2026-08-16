import Link from "next/link";
import { formatCentavosAsPHP } from "@/lib/money";
import type { ProductView } from "@/lib/types";
import { AddToCartButton } from "@/components/AddToCartButton";

export function ProductCard({ product }: { product: ProductView }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 transition hover:shadow-md">
      <Link href={`/products/${product.slug}`} className="block aspect-square overflow-hidden bg-neutral-100">
        {/* Seed images are locally-generated SVG placeholders (see prisma/seed.ts) —
            a plain <img> avoids next/image's SVG-optimization restrictions. */}
        <img
          src={product.imageUrl}
          alt={product.name}
          width={600}
          height={600}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/products/${product.slug}`}>
          <h3 className="font-medium text-neutral-900">{product.name}</h3>
        </Link>
        <p className="text-sm font-semibold text-neutral-900">
          {formatCentavosAsPHP(product.priceCentavos)}
        </p>
        {product.stock <= 5 && product.stock > 0 && (
          <p className="text-xs text-amber-600">Only {product.stock} left</p>
        )}
        <div className="mt-auto pt-2">
          <AddToCartButton product={product} />
        </div>
      </div>
    </div>
  );
}
