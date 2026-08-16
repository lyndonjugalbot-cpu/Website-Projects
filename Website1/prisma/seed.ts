// Seeds the database with DEMO catalog data and one initial admin account.
// Run with: npm run db:seed
//
// The products below are placeholder/demo data (see README "Seed data") —
// generic Korean-grocery-style items with locally-generated SVG images, not
// a real inventory feed. Add real products via the admin dashboard
// (/admin/products) once you're ready to go live.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { ProductCategory } from "@/generated/prisma/enums";

// Prices are entered here in whole pesos for readability and converted to
// centavos (PHP cents) below, since that's how Product.priceCentavos is
// stored (see prisma/schema.prisma for why).
const products: {
  slug: string;
  name: string;
  description: string;
  pricePhp: number;
  salePricePhp?: number;
  imageUrl: string;
  stock: number;
  category: ProductCategory;
  isFeatured?: boolean;
  isBestSeller?: boolean;
}[] = [
  {
    slug: "honey-butter-chips",
    name: "Honey Butter Potato Chips",
    description: "Crispy potato chips with a sweet-savory honey butter glaze — a Korean snack-aisle favorite.",
    pricePhp: 129,
    imageUrl: "/products/honey-butter-chips.svg",
    stock: 60,
    category: "SNACKS",
    isBestSeller: true,
  },
  {
    slug: "choco-pie-12pack",
    name: "Choco Pie (12-Pack)",
    description: "Soft marshmallow sandwiched between chocolate-coated cake layers. A classic Korean lunchbox treat.",
    pricePhp: 189,
    salePricePhp: 159,
    imageUrl: "/products/choco-pie-12pack.svg",
    stock: 45,
    category: "SNACKS",
    isFeatured: true,
  },
  {
    slug: "milkis-soda",
    name: "Milkis Soda 250ml",
    description: "A lightly carbonated, milky-sweet soft drink — refreshing and distinctly Korean.",
    pricePhp: 65,
    imageUrl: "/products/milkis-soda.svg",
    stock: 90,
    category: "BEVERAGES",
    isBestSeller: true,
  },
  {
    slug: "sikhye-rice-punch",
    name: "Sikhye Sweet Rice Punch (Can)",
    description: "A traditional sweet Korean rice beverage, served chilled. Mildly sweet with a subtle malty aroma.",
    pricePhp: 79,
    imageUrl: "/products/sikhye-rice-punch.svg",
    stock: 50,
    category: "BEVERAGES",
  },
  {
    slug: "spicy-chicken-ramen",
    name: "Spicy Chicken Instant Ramen",
    description: "Fiery, stir-fried instant noodles with a bold spicy-sweet chicken flavor sauce.",
    pricePhp: 89,
    imageUrl: "/products/spicy-chicken-ramen.svg",
    stock: 120,
    category: "INSTANT_NOODLES",
    isFeatured: true,
    isBestSeller: true,
  },
  {
    slug: "jjajangmyeon-noodles",
    name: "Jjajangmyeon Instant Noodles",
    description: "Instant black bean sauce noodles — savory, slightly sweet, and satisfying.",
    pricePhp: 95,
    imageUrl: "/products/jjajangmyeon-noodles.svg",
    stock: 80,
    category: "INSTANT_NOODLES",
  },
  {
    slug: "frozen-mandu-dumplings",
    name: "Frozen Mandu Dumplings (Pork & Vegetable)",
    description: "Bite-sized Korean dumplings filled with seasoned pork and vegetables — steam, pan-fry, or fry.",
    pricePhp: 249,
    imageUrl: "/products/frozen-mandu-dumplings.svg",
    stock: 35,
    category: "FROZEN_FOOD",
    isFeatured: true,
  },
  {
    slug: "hotteok-pancake-mix",
    name: "Hotteok Sweet Pancake Mix",
    description: "Easy-to-prepare mix for hotteok — Korean street-food pancakes filled with cinnamon-sugar syrup.",
    pricePhp: 175,
    imageUrl: "/products/hotteok-pancake-mix.svg",
    stock: 25,
    category: "FROZEN_FOOD",
  },
  {
    slug: "gochujang-chili-paste",
    name: "Gochujang Korean Chili Paste 500g",
    description: "Fermented red chili paste — the essential base for countless Korean dishes and marinades.",
    pricePhp: 285,
    imageUrl: "/products/gochujang-chili-paste.svg",
    stock: 40,
    category: "SAUCES_CONDIMENTS",
    isBestSeller: true,
  },
  {
    slug: "soy-garlic-sauce",
    name: "Soy Garlic Wing Sauce",
    description: "Sweet and savory soy garlic sauce, ready to toss with fried chicken wings, Korean-style.",
    pricePhp: 165,
    imageUrl: "/products/soy-garlic-sauce.svg",
    stock: 30,
    category: "SAUCES_CONDIMENTS",
  },
  {
    slug: "sheet-mask-set",
    name: "Korean Sheet Mask Set (10pc)",
    description: "A 10-piece variety pack of hydrating Korean sheet masks for a quick at-home skincare routine.",
    pricePhp: 349,
    salePricePhp: 299,
    imageUrl: "/products/sheet-mask-set.svg",
    stock: 55,
    category: "BEAUTY_PERSONAL_CARE",
    isFeatured: true,
  },
  {
    slug: "snail-mucin-essence",
    name: "Snail Mucin Repair Essence",
    description: "A lightweight, fast-absorbing essence formulated to hydrate and support skin barrier repair.",
    pricePhp: 599,
    imageUrl: "/products/snail-mucin-essence.svg",
    stock: 20,
    category: "BEAUTY_PERSONAL_CARE",
  },
  {
    slug: "korean-dish-soap",
    name: "Korean Fruit-Scented Dish Soap 1L",
    description: "A gentle, fruit-scented dish soap that cuts through grease without drying out your hands.",
    pricePhp: 145,
    imageUrl: "/products/korean-dish-soap.svg",
    stock: 40,
    category: "HOUSEHOLD",
  },
  {
    slug: "chopsticks-spoon-set",
    name: "Stainless Steel Chopsticks & Spoon Set",
    description: "A traditional Korean-style stainless steel chopsticks and flat spoon pair, dishwasher safe.",
    pricePhp: 199,
    imageUrl: "/products/chopsticks-spoon-set.svg",
    stock: 30,
    category: "KITCHENWARE",
  },
];

async function main() {
  for (const p of products) {
    const data = {
      name: p.name,
      description: p.description,
      priceCentavos: Math.round(p.pricePhp * 100),
      salePriceCentavos: p.salePricePhp ? Math.round(p.salePricePhp * 100) : null,
      imageUrl: p.imageUrl,
      stock: p.stock,
      category: p.category,
      isFeatured: p.isFeatured ?? false,
      isBestSeller: p.isBestSeller ?? false,
    };
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: data,
      create: { slug: p.slug, ...data },
    });
  }
  console.log(`Seeded ${products.length} demo products.`);

  const ownerEmail = process.env.SEED_ADMIN_EMAIL;
  const ownerPassword = process.env.SEED_ADMIN_PASSWORD;
  if (ownerEmail && ownerPassword) {
    const passwordHash = await bcrypt.hash(ownerPassword, 12);
    await prisma.user.upsert({
      where: { email: ownerEmail },
      update: {},
      create: { name: "Store Owner", email: ownerEmail, passwordHash, role: "OWNER" },
    });
    console.log(`Seeded owner account: ${ownerEmail} (change this password after your first login!)`);
  } else {
    console.warn("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping owner account seed.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
