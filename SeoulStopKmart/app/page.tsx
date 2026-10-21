import Link from "next/link";
import Image from "next/image";
import { getFeaturedProducts, getBestSellerProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { DELIVERY_AREAS, FACEBOOK_URL, STORE_NAME } from "@/lib/store-config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featured, bestSellers] = await Promise.all([getFeaturedProducts(4), getBestSellerProducts(4)]);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-neutral-200 bg-brand-black">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 20%, #FFC600 0%, transparent 40%), radial-gradient(circle at 80% 60%, #D41A1A 0%, transparent 45%)",
          }}
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-16 sm:px-6 sm:py-24">
          <Image src="/brand/logo.png" alt={STORE_NAME} width={220} height={190} className="h-20 w-auto animate-fade-in sm:h-24" priority />
          <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Korean groceries, snacks &amp; K-beauty — delivered fresh across Cebu.
          </h1>
          <p className="max-w-lg text-neutral-300">
            From spicy ramen and gochujang to sheet masks and frozen mandu — everything you need for a Korean pantry,
            just a tap away.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-full bg-brand-red px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-red-dark"
            >
              Shop all products
            </Link>
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Follow us on Facebook
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <ValueProp
            title="Genuinely Korean"
            body="Curated snacks, sauces, frozen food, and beauty picks — the real Korean mart experience, right in Cebu."
          />
          <ValueProp
            title={`Delivering to ${DELIVERY_AREAS}`}
            body="Order online and get it delivered to your door, with cash on delivery, GCash, Maya, or bank transfer."
          />
          <ValueProp
            title="Fresh stock, fair prices"
            body="We restock regularly and keep prices honest — no markup surprises at checkout."
          />
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Featured products</h2>
            <Link href="/products" className="text-sm font-medium text-neutral-600 hover:text-brand-red">
              View all &rarr;
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {bestSellers.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Best sellers</h2>
            <Link href="/products" className="text-sm font-medium text-neutral-600 hover:text-brand-red">
              View all &rarr;
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
            {bestSellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {featured.length === 0 && bestSellers.length === 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6">
          <p className="text-neutral-500">
            No products yet. Run <code className="rounded bg-neutral-100 px-1.5 py-0.5">npm run db:seed</code> to add
            sample data, or add products from the admin dashboard.
          </p>
        </section>
      )}
    </div>
  );
}

function ValueProp({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-6">
      <h3 className="font-medium text-neutral-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">{body}</p>
    </div>
  );
}
