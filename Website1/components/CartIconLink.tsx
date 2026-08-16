"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";

export function CartIconLink() {
  const { itemCount, isLoaded } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
      className="relative inline-flex items-center rounded-full p-2 text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className="h-6 w-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 1.94-4.79 2.432-7.394a1.125 1.125 0 00-1.106-1.331H5.106M7.5 14.25L5.106 5.856M7.5 14.25L5.25 21m11.25-6.75L21 21m0 0H3.75"
        />
      </svg>
      {isLoaded && itemCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1 text-xs font-medium text-white">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
