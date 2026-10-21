"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { formatCentavosAsPHP } from "@/lib/money";
import { CartItemRow } from "@/components/CartItemRow";

export default function CartPage() {
  const { items, subtotalCentavos, isLoaded } = useCart();
  const router = useRouter();

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-neutral-400 sm:px-6">
        Loading cart&hellip;
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-20 text-center sm:px-6">
        <h1 className="text-xl font-semibold text-neutral-900">Your cart is empty</h1>
        <p className="text-neutral-500">Browse the shop and add something you like.</p>
        <Link
          href="/products"
          className="mt-2 inline-flex items-center justify-center rounded-full bg-brand-red px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-red-dark"
        >
          Shop all products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Your cart</h1>

      <div className="mt-6 rounded-2xl border border-neutral-200 px-5">
        {items.map((item) => (
          <CartItemRow key={item.productId} item={item} />
        ))}
      </div>

      <div className="mt-6 flex flex-col items-end gap-3 border-t border-neutral-200 pt-6">
        <div className="flex w-full max-w-xs items-center justify-between text-base">
          <span className="text-neutral-600">Subtotal</span>
          <span className="font-semibold text-neutral-900">{formatCentavosAsPHP(subtotalCentavos)}</span>
        </div>
        <p className="text-xs text-neutral-400">Shipping and delivery details are collected at checkout.</p>
        <button
          type="button"
          onClick={() => router.push("/checkout")}
          className="w-full max-w-xs rounded-full bg-brand-red px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-red-dark"
        >
          Proceed to checkout
        </button>
      </div>
    </div>
  );
}
