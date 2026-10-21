"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatCentavosAsPHP } from "@/lib/money";
import { QuantityStepper } from "@/components/QuantityStepper";
import type { CartItem } from "@/lib/types";

export function CartItemRow({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCart();

  return (
    <div className="flex gap-4 border-b border-neutral-200 py-5 last:border-b-0">
      <Link href={`/products/${item.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
        <img src={item.imageUrl} alt={item.name} width={80} height={80} className="h-full w-full object-cover" />
      </Link>

      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href={`/products/${item.slug}`} className="font-medium text-neutral-900 hover:underline">
            {item.name}
          </Link>
          <p className="text-sm text-neutral-500">{formatCentavosAsPHP(item.priceCentavos)} each</p>
          <button
            type="button"
            onClick={() => removeItem(item.productId)}
            className="mt-1 text-xs font-medium text-neutral-400 hover:text-red-600"
          >
            Remove
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
          <QuantityStepper
            quantity={item.quantity}
            max={item.stock}
            onChange={(next) => updateQuantity(item.productId, next)}
          />
          <p className="font-medium text-neutral-900">
            {formatCentavosAsPHP(item.priceCentavos * item.quantity)}
          </p>
        </div>
      </div>
    </div>
  );
}
