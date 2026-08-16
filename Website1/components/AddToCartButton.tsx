"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import type { ProductView } from "@/lib/types";

export function AddToCartButton({
  product,
  quantity = 1,
  className,
}: {
  product: ProductView;
  quantity?: number;
  className?: string;
}) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const outOfStock = product.stock <= 0;

  function handleAdd() {
    addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        priceCentavos: product.priceCentavos,
        imageUrl: product.imageUrl,
        stock: product.stock,
      },
      quantity
    );
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={outOfStock}
      className={
        className ??
        "inline-flex w-full items-center justify-center rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
      }
    >
      {outOfStock ? "Out of stock" : justAdded ? "Added ✓" : "Add to cart"}
    </button>
  );
}
