import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PERMISSIONS = [
  { key: "listings.approve", description: "Approve or reject pending listings" },
  { key: "listings.remove", description: "Remove a live listing" },
  { key: "users.ban", description: "Suspend or ban a user account" },
  { key: "verification.review", description: "Review identity verification submissions" },
  { key: "verification.viewDocuments", description: "View uploaded ID documents" },
  { key: "disputes.manage", description: "Resolve buyer/seller disputes" },
  { key: "settings.manage", description: "Edit platform settings and fees" },
];

async function main() {
  console.log("Seeding permissions...");
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key: p.key }, update: {}, create: p });
  }

  const passwordHash = await bcrypt.hash("Password123!", 12);

  console.log("Seeding users...");
  const admin = await prisma.user.upsert({
    where: { email: "admin@wotstcgvault.co.nz" },
    update: {},
    create: {
      fullName: "Vault Admin",
      username: "vault_admin",
      email: "admin@wotstcgvault.co.nz",
      passwordHash,
      role: "SUPER_ADMIN",
      location: "Auckland",
      isEmailVerified: true,
      isFacebookLinked: true,
      isIdVerified: true,
      isTrustedSeller: true,
      acceptedTermsAt: new Date(),
      acceptedPrivacyAt: new Date(),
      sellerTermsAt: new Date(),
    },
  });

  const seller = await prisma.user.upsert({
    where: { email: "seller@wotstcgvault.co.nz" },
    update: {},
    create: {
      fullName: "Sarah Chen",
      username: "sarah_slabs",
      email: "seller@wotstcgvault.co.nz",
      passwordHash,
      role: "SELLER",
      location: "Wellington",
      bio: "PSA-obsessed collector selling from a smoke-free, pet-free home. Same-day tracked shipping across NZ.",
      isEmailVerified: true,
      isFacebookLinked: true,
      isIdVerified: true,
      isTrustedSeller: true,
      acceptedTermsAt: new Date(),
      acceptedPrivacyAt: new Date(),
      sellerTermsAt: new Date(),
    },
  });

  await prisma.facebookConnection.upsert({
    where: { userId: seller.id },
    update: {},
    create: {
      userId: seller.id,
      facebookUserId: "demo-fb-12345",
      profileUrl: "https://facebook.com/sarah.chen.demo",
      publicConsent: true,
      consentUpdatedAt: new Date(),
    },
  });

  const buyer = await prisma.user.upsert({
    where: { email: "buyer@wotstcgvault.co.nz" },
    update: {},
    create: {
      fullName: "Jordan Lee",
      username: "jordan_collects",
      email: "buyer@wotstcgvault.co.nz",
      passwordHash,
      role: "BUYER",
      location: "Christchurch",
      isEmailVerified: true,
      acceptedTermsAt: new Date(),
      acceptedPrivacyAt: new Date(),
    },
  });

  console.log("Seeding listings...");
  const listingsData = [
    {
      title: "Charizard VMAX Rainbow Rare — Champion's Path",
      category: "SINGLE_CARD" as const,
      setName: "Champion's Path",
      cardNumber: "074/073",
      priceCents: 45000,
      condition: "NEAR_MINT" as const,
      description:
        "Stunning Charizard VMAX Rainbow Rare from Champion's Path. Pulled directly from a sealed booster box and stored in a top loader since. Sharp corners, strong centering front and back.",
    },
    {
      title: "PSA 10 Pikachu Illustrator Promo (Reprint)",
      category: "GRADED_SLAB" as const,
      setName: "Promo",
      priceCents: 120000,
      gradingCompany: "PSA" as const,
      grade: "10",
      certificationNumber: "88293471",
      description: "Graded PSA 10 GEM MINT. Slab is pristine with no cracks, scuffs or yellowing.",
    },
    {
      title: "Scarlet & Violet Booster Box — Factory Sealed",
      category: "BOOSTER_BOX" as const,
      setName: "Scarlet & Violet Base Set",
      priceCents: 22000,
      description: "Factory sealed booster box, 36 packs. Purchased directly from an authorised NZ distributor.",
    },
    {
      title: "Obsidian Flames Elite Trainer Box",
      category: "ELITE_TRAINER_BOX" as const,
      setName: "Obsidian Flames",
      priceCents: 8500,
      description: "Brand new, factory sealed Elite Trainer Box with original shrink wrap intact.",
    },
    {
      title: "BGS 9.5 Umbreon Gold Star — POP 12",
      category: "GRADED_SLAB" as const,
      setName: "POP Series 5",
      priceCents: 350000,
      gradingCompany: "BGS" as const,
      grade: "9.5",
      certificationNumber: "0019284712",
      description: "One of the most sought after Gold Stars. BGS 9.5 with 9.5 subgrades across corners and edges.",
    },
    {
      title: "Vintage Base Set Collection Lot (12 Cards)",
      category: "COLLECTION" as const,
      setName: "Base Set",
      priceCents: 60000,
      condition: "EXCELLENT" as const,
      description: "A curated lot of 12 vintage Base Set cards including holo rares. Full photos of every card on request.",
    },
    {
      title: "Premium Toploaders (Pack of 25) + Card Sleeves",
      category: "ACCESSORIES" as const,
      priceCents: 3200,
      description: "Rigid 3x4 toploaders plus 100 penny sleeves. Perfect for protecting graded submissions and raw cards alike.",
    },
    {
      title: "151 Booster Pack Bundle (x10)",
      category: "BOOSTER_PACK" as const,
      setName: "Scarlet & Violet 151",
      priceCents: 15000,
      description: "10 individual booster packs from Scarlet & Violet 151, sold as sealed singles pulled from a sealed case.",
    },
  ];

  for (const [i, data] of listingsData.entries()) {
    const slug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
      .concat(`-${i}`);

    const listing = await prisma.listing.upsert({
      where: { slug },
      update: {},
      create: {
        sellerId: seller.id,
        title: data.title,
        slug,
        category: data.category,
        setName: data.setName,
        cardNumber: "cardNumber" in data ? data.cardNumber : undefined,
        priceCents: data.priceCents,
        condition: "condition" in data ? data.condition : undefined,
        gradingCompany: "gradingCompany" in data ? data.gradingCompany : undefined,
        grade: "grade" in data ? data.grade : undefined,
        certificationNumber: "certificationNumber" in data ? data.certificationNumber : undefined,
        description: data.description,
        isAuthenticityDeclared: true,
        region: "Wellington",
        offersDelivery: true,
        offersPickup: i % 3 === 0,
        status: "ACTIVE",
        publishedAt: new Date(),
        images: {
          create: [
            {
              url: `https://placehold.co/800x1120/0c0c0d/d4af37.png?text=${encodeURIComponent(data.title.slice(0, 18))}`,
              angle: "FRONT",
              position: 0,
              moderationStatus: "APPROVED",
            },
            {
              url: `https://placehold.co/800x1120/0c0c0d/9a978f.png?text=Back`,
              angle: "BACK",
              position: 1,
              moderationStatus: "APPROVED",
            },
          ],
        },
        shippingOptions: {
          create: [
            { name: "NZ Post Tracked", priceCents: 700, hasInsurance: false },
            { name: "Courier (Signature Required)", priceCents: 1200, hasInsurance: true },
          ],
        },
      },
    });
    console.log(`  listing: ${listing.title}`);
  }

  console.log("Seeding a sample collection...");
  await prisma.collection.upsert({
    where: { id: "seed-collection-buyer" },
    update: {},
    create: {
      id: "seed-collection-buyer",
      ownerId: buyer.id,
      name: "My Kanto Showcase",
      description: "A growing collection of Kanto-era favourites.",
      isPublic: true,
      items: {
        create: [
          {
            name: "Blastoise Base Set Holo",
            setName: "Base Set",
            category: "SINGLE_CARD",
            condition: "EXCELLENT",
            images: [],
            estimatedValueCents: 18000,
            isPublic: true,
          },
        ],
      },
    },
  });

  console.log("Seeding demo payout account...");
  await prisma.sellerPayoutAccount.upsert({
    where: { userId: seller.id },
    update: {},
    create: {
      userId: seller.id,
      // Demo-only placeholder id — a real Stripe Connect account is only
      // ever created by /api/stripe/connect/onboard. This lets the admin
      // UI and seller dashboard render a fully "enabled" state without
      // live Stripe credentials in local dev.
      stripeConnectAccountId: "acct_demo_seed_only",
      status: "ENABLED",
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    },
  });

  console.log("Seed complete.");
  console.log("Demo logins (password: Password123!):");
  console.log(`  Admin:  ${admin.email}`);
  console.log(`  Seller: ${seller.email}`);
  console.log(`  Buyer:  ${buyer.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
