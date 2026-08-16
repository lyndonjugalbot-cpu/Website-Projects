import Link from "next/link";
import { getFeaturedProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const featured = await getFeaturedProducts(4);

  return (
    <div>
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:px-6 sm:py-24">
          <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            Everyday goods, delivered around the Philippines.
          </h1>
          <p className="max-w-lg text-neutral-600">
            A demo storefront showcasing a full checkout flow with GCash, Maya, and card
            payments via PayMongo (sandbox).
          </p>
          <Link
            href="/products"
            className="mt-2 inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            Shop all products
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Featured products</h2>
          <Link href="/products" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
            View all &rarr;
          </Link>
        </div>

        {featured.length === 0 ? (
          <p className="mt-8 text-neutral-500">
            No products yet. Run <code className="rounded bg-neutral-100 px-1.5 py-0.5">npm run db:seed</code> to add sample data.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
