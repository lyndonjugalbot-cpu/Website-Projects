// Seeds the database with sample catalog data.
// Run with: npm run db:seed
import { prisma } from "@/lib/prisma";

// Prices are entered here in whole pesos for readability and converted to
// centavos (PHP cents) below, since that's how Product.priceCentavos is
// stored (see prisma/schema.prisma for why).
const products = [
  {
    slug: "canvas-tote-bag",
    name: "Everyday Canvas Tote Bag",
    description:
      "A durable, heavyweight canvas tote with reinforced handles — roomy enough for groceries, books, or a laptop.",
    pricePhp: 349,
    imageUrl: "/products/canvas-tote-bag.svg",
    stock: 40,
  },
  {
    slug: "ceramic-pour-over-mug",
    name: "Ceramic Pour-Over Mug",
    description:
      "A 350ml matte-finish ceramic mug with a built-in pour-over dripper, perfect for a slow morning coffee.",
    pricePhp: 279,
    imageUrl: "/products/ceramic-pour-over-mug.svg",
    stock: 60,
  },
  {
    slug: "wireless-earbuds-pro",
    name: "Wireless Earbuds Pro",
    description:
      "True wireless earbuds with active noise cancellation, 24-hour battery life with the charging case, and IPX4 water resistance.",
    pricePhp: 1499,
    imageUrl: "/products/wireless-earbuds-pro.svg",
    stock: 25,
  },
  {
    slug: "minimalist-leather-wallet",
    name: "Minimalist Leather Wallet",
    description:
      "A slim genuine-leather bifold wallet with 6 card slots and a central cash pocket. Fits comfortably in any pocket.",
    pricePhp: 899,
    imageUrl: "/products/minimalist-leather-wallet.svg",
    stock: 30,
  },
  {
    slug: "stainless-steel-tumbler",
    name: "Stainless Steel Tumbler 500ml",
    description:
      "Double-wall vacuum insulated tumbler that keeps drinks cold for 24 hours or hot for 12. Leak-proof lid included.",
    pricePhp: 459,
    imageUrl: "/products/stainless-steel-tumbler.svg",
    stock: 50,
  },
  {
    slug: "cotton-crew-neck-tee",
    name: "Cotton Crew Neck Tee",
    description:
      "A soft, breathable 100% combed cotton t-shirt with a relaxed fit. Pre-shrunk and available in classic colors.",
    pricePhp: 399,
    imageUrl: "/products/cotton-crew-neck-tee.svg",
    stock: 100,
  },
  {
    slug: "power-bank-10000mah",
    name: "Power Bank 10000mAh",
    description:
      "Compact fast-charging power bank with dual USB-A and USB-C ports — enough juice for 2+ full phone charges.",
    pricePhp: 799,
    imageUrl: "/products/power-bank-10000mah.svg",
    stock: 35,
  },
  {
    slug: "scented-soy-candle",
    name: "Scented Soy Candle",
    description:
      "Hand-poured 100% soy wax candle in a reusable glass jar, with a clean 40-hour burn time. Calming lavender-vanilla scent.",
    pricePhp: 249,
    imageUrl: "/products/scented-soy-candle.svg",
    stock: 45,
  },
  {
    slug: "bluetooth-mini-speaker",
    name: "Bluetooth Mini Speaker",
    description:
      "Palm-sized Bluetooth 5.0 speaker with surprisingly full sound, 10-hour battery, and a built-in carabiner clip.",
    pricePhp: 999,
    imageUrl: "/products/bluetooth-mini-speaker.svg",
    stock: 20,
  },
  {
    slug: "bamboo-desk-organizer",
    name: "Bamboo Desk Organizer",
    description:
      "A multi-slot bamboo organizer for pens, phone, and sticky notes — keeps your desk tidy without the clutter.",
    pricePhp: 599,
    imageUrl: "/products/bamboo-desk-organizer.svg",
    stock: 15,
  },
];

async function main() {
  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        priceCentavos: Math.round(p.pricePhp * 100),
        imageUrl: p.imageUrl,
        stock: p.stock,
      },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        priceCentavos: Math.round(p.pricePhp * 100),
        imageUrl: p.imageUrl,
        stock: p.stock,
      },
    });
  }

  console.log(`Seeded ${products.length} products.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
