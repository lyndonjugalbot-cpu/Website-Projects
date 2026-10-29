import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BUSINESS_HOURS, DELIVERY_AREAS, FACEBOOK_URL, STORE_NAME } from "@/lib/store-config";

export const metadata: Metadata = {
  title: "About",
  description: `${STORE_NAME} is a Korean convenience store in Yati, Liloan, Cebu: ramen, snacks, sauces, frozen food and K-beauty, open late and delivered across Cebu.`,
};

const AISLES = [
  { name: "Instant noodles", note: "Shin, Buldak, Neoguri, jjajang and more", href: "/products?category=INSTANT_NOODLES" },
  { name: "Snacks & sweets", note: "Pocky, Pepero, honey butter chips, ice cream", href: "/products?category=SNACKS" },
  { name: "Drinks", note: "Milkis, soju, juice pouches, canned coffee", href: "/products?category=BEVERAGES" },
  { name: "Sauces & pantry", note: "Gochujang, sesame oil, seaweed, rice", href: "/products?category=SAUCES_CONDIMENTS" },
  { name: "Frozen food", note: "Dumplings, tteokbokki, fish cake", href: "/products?category=FROZEN_FOOD" },
  { name: "K-beauty", note: "Cleansers, masks, skincare picks", href: "/products?category=BEAUTY_PERSONAL_CARE" },
];

const STEPS = [
  { n: "01", title: "Pick your cravings", body: "Browse the aisles online, from a single cup noodle to a full Korean pantry." },
  { n: "02", title: "Pay your way", body: "GCash, Maya, card, bank transfer or cash on delivery." },
  { n: "03", title: "We bring it over", body: `Delivered to ${DELIVERY_AREAS}, or drop by the store in Yati, Liloan.` },
];

export default function AboutPage() {
  return (
    <div className="-mb-16 bg-brand-black pb-16 text-white">
      <section className="relative isolate overflow-hidden [clip-path:polygon(0_0,100%_0,100%_calc(100%-2.5rem),0_100%)] sm:[clip-path:polygon(0_0,100%_0,100%_calc(100%-4rem),0_100%)]">
        <Image
          src="/brand/hero-aisle.jpg"
          alt=""
          fill
          sizes="100vw"
          className="-z-20 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-black/95 via-brand-black/80 to-brand-black/50" />
        <div className="mx-auto max-w-7xl px-4 pb-28 pt-24 sm:px-6 sm:pb-36 sm:pt-32">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand-gold">About us</p>
          <h1 className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-7xl">
            A little corner of <span className="italic text-brand-gold">Seoul</span> in Liloan.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-neutral-300 sm:text-lg">
            {STORE_NAME} is your go-to Korean convenience store: the noodles, snacks, sauces and drinks you would grab on
            any Seoul street corner, on the shelf when you want them.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 pt-4 sm:px-6 lg:grid-cols-4">
        <Stat value="1,000+" label="Korean & Asian products" />
        <Stat value="8am – 3am" label="Open every day" />
        <Stat value="3.9K" label="Followers on Facebook" />
        <Stat value="5 ways" label="To pay, including COD" />
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">What you will find on our shelves</h2>
            <p className="mt-4 max-w-md leading-relaxed text-neutral-400">
              We stock the everyday staples and the fun stuff: the ramen you cook at midnight, the snacks you bring to a
              party, and the sauces that make a Korean kitchen work.
            </p>
          </div>
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {AISLES.map((aisle) => (
              <li key={aisle.name}>
                <Link
                  href={aisle.href}
                  className="group flex items-center justify-between gap-4 py-5 transition hover:pl-2"
                >
                  <div>
                    <p className="font-display text-xl font-semibold text-white transition group-hover:text-brand-gold">
                      {aisle.name}
                    </p>
                    <p className="mt-1 text-sm text-neutral-400">{aisle.note}</p>
                  </div>
                  <span className="text-lg text-neutral-500 transition group-hover:translate-x-1 group-hover:text-brand-gold" aria-hidden>
                    &rarr;
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">How ordering works</h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.n}
              className={`rounded-3xl p-7 ${
                i === 1 ? "bg-brand-red text-white" : i === 2 ? "bg-brand-gold text-brand-black" : "bg-[#2a2420] ring-1 ring-white/10"
              }`}
            >
              <span className="font-display text-sm tracking-widest opacity-70">{step.n}</span>
              <p className="mt-6 font-display text-2xl font-semibold">{step.title}</p>
              <p className={`mt-2 text-sm leading-relaxed ${i === 0 ? "text-neutral-400" : "opacity-90"}`}>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
        <div className="grid gap-8 rounded-3xl bg-[#1f1a17] p-8 ring-1 ring-white/10 sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand-gold">Visit us</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
              Yati, Lilo-an, Cebu
            </h2>
            <p className="mt-3 text-neutral-400">{BUSINESS_HOURS}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 lg:justify-end">
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-full bg-brand-red px-8 py-3.5 text-sm font-medium text-white transition hover:bg-brand-red-dark active:scale-[0.98]"
            >
              Start shopping
            </Link>
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-white underline decoration-white/30 underline-offset-8 transition hover:decoration-brand-gold"
            >
              Message us on Facebook
            </a>
          </div>
        </div>
      </section>
      <div className="h-12" />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[#1f1a17] px-6 py-8 first:rounded-tl-3xl last:rounded-br-3xl">
      <p className="font-display text-3xl font-semibold text-brand-gold sm:text-4xl">{value}</p>
      <p className="mt-1 text-sm text-neutral-400">{label}</p>
    </div>
  );
}
