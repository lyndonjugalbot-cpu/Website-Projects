import { prisma } from "@/lib/prisma";
import type { ListingCardData } from "@/types/listing";

export const listingCardSelect = {
  id: true,
  title: true,
  slug: true,
  category: true,
  setName: true,
  priceCents: true,
  condition: true,
  gradingCompany: true,
  grade: true,
  region: true,
  createdAt: true,
  favoriteCount: true,
  images: { select: { url: true, angle: true }, orderBy: { position: "asc" as const } },
  seller: {
    select: {
      username: true,
      displayName: true,
      fullName: true,
      isIdVerified: true,
      isTrustedSeller: true,
      avatarUrl: true,
    },
  },
} as const;

export async function attachFavorites(
  listings: ListingCardData[],
  userId?: string | null
): Promise<ListingCardData[]> {
  if (!userId || listings.length === 0) return listings;
  const favorites = await prisma.favorite.findMany({
    where: { userId, listingId: { in: listings.map((l) => l.id) } },
    select: { listingId: true },
  });
  const favoritedIds = new Set(favorites.map((f) => f.listingId));
  return listings.map((l) => ({ ...l, isFavorited: favoritedIds.has(l.id) }));
}
