import Link from "next/link";
import Image from "next/image";
import { getFeaturedProducts, getBestSellerProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { DELIVERY_AREAS, FACEBOOK_URL } from "@/lib/store-config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featured, bestSellers] = await Promise.all([getFeaturedProducts(4), getBestSellerProducts(4)]);

  return (
    <div className="-mb-16 bg-brand-black pb-16 text-white">
      <section className="relative isolate flex min-h-[calc(100dvh-6.5rem)] items-end overflow-hidden bg-brand-black [clip-path:polygon(0_0,100%_0,100%_calc(100%-2.5rem),0_100%)] sm:[clip-path:polygon(0_0,100%_0,100%_calc(100%-4.5rem),0_100%)]">
        <Image
          src="/brand/hero-aisle.jpg"
          alt="A Korean grocery aisle with drinks on the left shelves and instant noodles on the right"
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-black/60 via-brand-black/25 to-transparent" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_55%_60%_at_18%_68%,rgba(23,20,18,0.82),transparent)]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-black/80 via-transparent to-brand-black/30" />

        <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-24 sm:px-6 sm:pb-32">
          <p className="animate-rise text-xs font-medium uppercase tracking-[0.25em] text-brand-gold">
            Korean convenience store &middot; Yati, Liloan
          </p>
          <h1 className="animate-rise mt-5 max-w-3xl font-display text-5xl font-semibold leading-[1.02] tracking-tight text-white text-balance [animation-delay:80ms] sm:text-7xl lg:text-8xl">
            Seoul, <span className="italic text-brand-gold">round the corner.</span>
          </h1>
          <p className="animate-rise mt-6 max-w-md text-base leading-relaxed text-neutral-200 [animation-delay:160ms] sm:text-lg">
            Your go-to Korean convenience store: ramen, tteokbokki, gochujang, snacks and K-beauty, in store or delivered across Cebu.
          </p>
          <div className="animate-rise mt-9 flex flex-wrap items-center gap-4 [animation-delay:240ms]">
            <Link
              href="/products?category=ALL"
              className="inline-flex items-center justify-center rounded-full bg-brand-red px-8 py-3.5 text-sm font-medium text-white shadow-lg shadow-brand-red/30 transition hover:bg-brand-red-dark active:scale-[0.98]"
            >
              Shop all products
            </Link>
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-white underline decoration-white/40 underline-offset-8 transition hover:decoration-brand-gold"
            >
              Follow us on Facebook
            </a>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#1f1a17]">
        <ul className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-white/10 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
          <ValueProp title="Genuinely Korean" body="Snacks, sauces, frozen food and beauty picks, the real mart experience." />
          <ValueProp title={`Delivering to ${DELIVERY_AREAS}`} body="Cash on delivery, GCash, Maya or bank transfer." />
          <ValueProp title="Fresh stock, fair prices" body="Restocked often, with no surprises at checkout." />
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">Shop by aisle</h2>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-2">
          <Link
            href="/products?category=FRESH_GROCERY"
            className="group relative col-span-2 row-span-2 flex min-h-[22rem] items-end overflow-hidden rounded-3xl bg-brand-black"
          >
            <Image
              src="/brand/feature-corndog.jpg"
              alt="A crispy cheese corn dog with a cheese pull, beside a bowl of kimchi and ketchup and mustard dips"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-black/85 via-brand-black/10 to-transparent" />
            <div className="relative p-6 sm:p-8">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-gold">Fresh &amp; hot</p>
              <p className="mt-2 font-display text-3xl font-semibold text-white sm:text-4xl">Fresh corndog &amp; kimchi</p>
              <p className="mt-2 text-sm text-neutral-200">Crispy corndogs, kimchi and fresh picks &rarr;</p>
            </div>
          </Link>
          <AisleTile
            href="/products?category=INSTANT_NOODLES"
            label="Instant noodles"
            tone="bg-brand-red text-white"
            image="/brand/aisle-noodles.jpg"
            imageAlt="A gold pot of spicy Korean ramen with egg, seaweed and green onion"
          />
          <AisleTile
            href="/products?category=SNACKS"
            label="Snacks"
            tone="bg-brand-gold text-white"
            image="/brand/aisle-snacks.jpg"
            imageAlt="Korean snacks: shrimp crackers, honey butter chips, seaweed and Pepero"
          />
          <AisleTile
            href="/products?category=FROZEN_FOOD"
            label="Frozen food"
            tone="bg-[#2a2420] text-white ring-1 ring-white/10"
            image="/brand/aisle-frozen-trays.jpg"
            imageAlt="Trays of marinated and unmarinated Korean BBQ pork and beef samgyupsal"
          />
          <AisleTile
            href="/products?category=BEVERAGES"
            label="K-drinks"
            tone="bg-[#2a2420] text-white"
            image="/brand/aisle-drinks-photo.jpg"
            imageAlt="Korean drinks: juice pouches, cola and Sprite cans, banana and strawberry milk and a soju bottle"
          />
        </div>
      </section>

      <div className="h-px" />
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">Featured products</h2>
            <Link href="/products?category=ALL" className="text-sm font-medium text-neutral-300 underline decoration-white/25 underline-offset-8 transition hover:text-brand-gold hover:decoration-brand-gold">
              View all &rarr;
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} dark />
            ))}
          </div>
        </section>
      )}

      {bestSellers.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">Best sellers</h2>
            <Link href="/products?category=ALL" className="text-sm font-medium text-neutral-300 underline decoration-white/25 underline-offset-8 transition hover:text-brand-gold hover:decoration-brand-gold">
              View all &rarr;
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
            {bestSellers.map((product) => (
              <ProductCard key={product.id} product={product} dark />
            ))}
          </div>
        </section>
      )}

      {featured.length === 0 && bestSellers.length === 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6">
          <p className="text-neutral-400">
            No products yet. Run <code className="rounded bg-white/10 px-1.5 py-0.5">npm run db:seed</code> to add
            sample data, or add products from the admin dashboard.
          </p>
        </section>
      )}
      <div className="h-12" />
    </div>
  );
}

function ValueProp({ title, body }: { title: string; body: string }) {
  return (
    <li className="px-0 py-6 sm:px-8 sm:first:pl-0 sm:last:pr-0">
      <h3 className="font-display text-lg font-semibold text-brand-gold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-neutral-400">{body}</p>
    </li>
  );
}

function AisleTile({
  href,
  label,
  tone,
  image,
  imageAlt,
}: {
  href: string;
  label: string;
  tone: string;
  image?: string;
  imageAlt?: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex min-h-[10.5rem] flex-col justify-between overflow-hidden rounded-3xl p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 active:scale-[0.99] ${tone}`}
    >
      {image && (
        <>
          <Image
            src={image}
            alt={imageAlt ?? ""}
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover object-[50%_55%] transition duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-black/80 via-brand-black/15 to-brand-black/10" />
        </>
      )}
      <span className="relative text-xl transition-transform duration-300 group-hover:translate-x-1" aria-hidden>
        &rarr;
      </span>
      <span className="relative font-display text-2xl font-semibold leading-tight">{label}</span>
    </Link>
  );
}
