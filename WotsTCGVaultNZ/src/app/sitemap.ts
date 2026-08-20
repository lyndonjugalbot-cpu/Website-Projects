import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.wotstcgvault.co.nz";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/marketplace`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/legal/terms`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/legal/privacy`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/legal/refund-policy`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/legal/prohibited-items`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/legal/authenticity-policy`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/legal/seller-guidelines`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/legal/community-guidelines`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    select: { slug: true, updatedAt: true },
    take: 5000,
  });

  const listingRoutes: MetadataRoute.Sitemap = listings.map((l) => ({
    url: `${siteUrl}/listing/${l.slug}`,
    lastModified: l.updatedAt,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  return [...staticRoutes, ...listingRoutes];
}
