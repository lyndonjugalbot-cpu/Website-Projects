import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { Star, MapPin, Calendar, Package, ShieldCheck } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attachFavorites, listingCardSelect } from "@/lib/queries";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerificationBadges } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import { ListingCard } from "@/components/marketplace/listing-card";
import { ReportUserButton } from "@/components/listing/report-user-button";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const session = await getServerSession(authOptions);

  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      _count: {
        select: {
          listings: { where: { status: "ACTIVE" } },
        },
      },
    },
  });

  if (!user || user.status === "BANNED") notFound();

  const isOwner = session?.user?.id === user.id;

  const [listings, collections, reviews, ratingAgg, completedSalesCount] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId: user.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: listingCardSelect,
    }),
    prisma.collection.findMany({
      where: { ownerId: user.id, ...(isOwner ? {} : { isPublic: true }) },
      include: { items: { where: isOwner ? {} : { isPublic: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.review.findMany({
      where: { subjectId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { author: { select: { username: true, displayName: true, avatarUrl: true } } },
    }),
    prisma.review.aggregate({ where: { subjectId: user.id }, _avg: { rating: true }, _count: { rating: true } }),
    prisma.orderItem.count({
      where: { sellerId: user.id, order: { status: "COMPLETED" } },
    }),
  ]);

  const listingsWithFavs = await attachFavorites(listings, session?.user?.id);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="card-luxury p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <Avatar className="h-24 w-24">
          <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="text-2xl">
            {(user.displayName ?? user.fullName).slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-display font-bold">{user.displayName ?? user.fullName}</h1>
            {user.isIdVerified && <ShieldCheck className="h-5 w-5 text-gold" />}
          </div>
          <p className="text-muted-2 text-sm">@{user.username}</p>
          {user.bio && <p className="text-sm text-muted mt-2 max-w-xl">{user.bio}</p>}

          <div className="mt-3">
            <VerificationBadges
              emailVerified={user.isEmailVerified}
              facebookLinked={user.isFacebookLinked}
              idVerified={user.isIdVerified}
              trustedSeller={user.isTrustedSeller}
              size="md"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-2 mt-3">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {user.location ?? "New Zealand"}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Joined {formatDate(user.joinedAt)}
            </span>
            {ratingAgg._count.rating > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-gold text-gold" /> {ratingAgg._avg.rating?.toFixed(1)} (
                {ratingAgg._count.rating} reviews)
              </span>
            )}
            <span className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" /> {completedSalesCount} completed sales
            </span>
          </div>
        </div>
        <ReportUserButton userId={user.id} />
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-display font-bold mb-6">
          Active Listings ({user._count.listings})
        </h2>
        {listingsWithFavs.length === 0 ? (
          <p className="text-sm text-muted-2">No active listings right now.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {listingsWithFavs.map((l, i) => (
              <ListingCard key={l.id} listing={l} index={i} />
            ))}
          </div>
        )}
      </section>

      {collections.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-display font-bold mb-6">Collection Showcase</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {collections.map((c) => (
              <div key={c.id} className="card-luxury p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">{c.name}</h3>
                  {!c.isPublic && <Badge variant="outline">Private</Badge>}
                </div>
                {c.description && <p className="text-sm text-muted mb-3">{c.description}</p>}
                <div className="grid grid-cols-4 gap-2">
                  {c.items.slice(0, 8).map((item) => (
                    <div key={item.id} className="aspect-square rounded-md bg-charcoal overflow-hidden relative">
                      {item.images[0] ? (
                        <Image src={item.images[0]} alt={item.name} fill className="object-cover" sizes="120px" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[9px] text-muted-2 p-1 text-center">
                          {item.name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-2 mt-3">{c.items.length} item{c.items.length === 1 ? "" : "s"}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {reviews.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-display font-bold mb-6">Reviews</h2>
          <div className="flex flex-col gap-4">
            {reviews.map((r) => (
              <div key={r.id} className="card-luxury p-4 flex gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={r.author.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback>{(r.author.displayName ?? r.author.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">@{r.author.username}</span>
                    <span className="flex items-center gap-0.5 text-xs text-gold">
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-gold" />
                      ))}
                    </span>
                  </div>
                  {r.comment && <p className="text-sm text-muted mt-1">{r.comment}</p>}
                  <p className="text-[11px] text-muted-2 mt-1">{formatDate(r.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
