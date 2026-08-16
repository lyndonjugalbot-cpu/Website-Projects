import type { Metadata } from "next";

export const metadata: Metadata = { title: "About — ShopEasePH" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">About ShopEasePH</h1>
      <p className="mt-4 leading-relaxed text-neutral-600">
        ShopEasePH is a sample storefront built to demonstrate a complete Next.js + Prisma + PayMongo
        ecommerce flow — catalog browsing, cart, checkout, and sandbox payments. It isn&apos;t a real
        store; no orders placed here result in real shipments or charges unless you&apos;ve connected
        live PayMongo keys.
      </p>
      <p className="mt-4 leading-relaxed text-neutral-600">
        Feel free to use this project as a starting point for your own storefront.
      </p>
    </div>
  );
}
