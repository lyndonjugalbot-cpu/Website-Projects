import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listingCardSelect, attachFavorites } from "@/lib/queries";
import { Hero } from "@/components/home/hero";
import { ListingRail } from "@/components/home/listing-rail";
import { CategoryGrid } from "@/components/home/category-grid";
import { FeaturedSellers } from "@/components/home/featured-sellers";
import { HowItWorks } from "@/components/home/how-it-works";
import { TrustSafety } from "@/components/home/trust-safety";
import { CtaSection } from "@/components/home/cta-section";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  const [featured, recent, topSellers] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ favoriteCount: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: listingCardSelect,
    }),
    prisma.listing.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: listingCardSelect,
    }),
    prisma.user.findMany({
      where: { role: "SELLER", status: "ACTIVE", listings: { some: { status: "ACTIVE" } } },
      take: 4,
      orderBy: { isTrustedSeller: "desc" },
      select: {
        username: true,
        displayName: true,
        fullName: true,
        avatarUrl: true,
        location: true,
        isIdVerified: true,
        isTrustedSeller: true,
        isEmailVerified: true,
        isFacebookLinked: true,
        _count: { select: { listings: { where: { status: "ACTIVE" } } } },
      },
    }),
  ]);

  const [featuredWithFavs, recentWithFavs] = await Promise.all([
    attachFavorites(featured, session?.user?.id),
    attachFavorites(recent, session?.user?.id),
  ]);

  const sellers = topSellers.map((s) => ({
    username: s.username,
    displayName: s.displayName,
    fullName: s.fullName,
    avatarUrl: s.avatarUrl,
    location: s.location,
    isIdVerified: s.isIdVerified,
    isTrustedSeller: s.isTrustedSeller,
    isEmailVerified: s.isEmailVerified,
    isFacebookLinked: s.isFacebookLinked,
    listingCount: s._count.listings,
  }));

  return (
    <>
      <Hero />
      <ListingRail
        title="Featured Listings"
        subtitle="Hand-picked, highly-favourited items from the vault."
        listings={featuredWithFavs}
        href="/marketplace"
        emptyMessage="No featured listings yet — check back soon."
      />
      <CategoryGrid />
      <ListingRail
        title="Recently Added"
        subtitle="Fresh off the shelf."
        listings={recentWithFavs}
        href="/marketplace?sort=newest"
        emptyMessage="No listings yet — be the first to sell."
      />
      <FeaturedSellers sellers={sellers} />
      <HowItWorks />
      <TrustSafety />
      <CtaSection />
    </>
  );
}
