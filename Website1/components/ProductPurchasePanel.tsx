"use client";

import { useState } from "react";
import { QuantityStepper } from "@/components/QuantityStepper";
import { AddToCartButton } from "@/components/AddToCartButton";
import type { ProductView } from "@/lib/types";
import { isPurchasable } from "@/lib/types";

export function ProductPurchasePanel({ product }: { product: ProductView }) {
  const [quantity, setQuantity] = useState(1);

  if (!isPurchasable(product)) {
    return (
      <div className="rounded-full bg-neutral-100 px-5 py-2.5 text-center text-sm font-medium text-neutral-500">
        Out of stock
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <QuantityStepper quantity={quantity} max={product.stock} onChange={setQuantity} />
      <AddToCartButton product={product} quantity={quantity} className="flex-1 rounded-full bg-brand-red px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red-dark" />
    </div>
  );
}
