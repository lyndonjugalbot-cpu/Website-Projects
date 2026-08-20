import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attachFavorites, listingCardSelect } from "@/lib/queries";
import { ImageGallery } from "@/components/listing/image-gallery";
import { SellerCard } from "@/components/listing/seller-card";
import { BuyBox } from "@/components/listing/buy-box";
import { DefectDisclosure } from "@/components/listing/defect-disclosure";
import { ReportListingButton } from "@/components/listing/report-listing-button";
import { ConditionBadge, GradingBadge } from "@/components/shared/badges";
import { ListingRail } from "@/components/home/listing-rail";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MapPin, Package, RotateCcw, Truck } from "lucide-react";
import { CATEGORY_LABELS, LANGUAGE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await prisma.listing.findUnique({ where: { slug }, select: { title: true, description: true } });
  if (!listing) return { title: "Listing not found" };
  return {
    title: listing.title,
    description: listing.description.slice(0, 155),
    openGraph: { title: listing.title, description: listing.description.slice(0, 155) },
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);

  const listing = await prisma.listing.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { position: "asc" } },
      shippingOptions: true,
      seller: {
        include: {
          facebookConnection: true,
          _count: { select: { listings: { where: { status: "ACTIVE" } } } },
        },
      },
    },
  });

  if (!listing || (listing.status !== "ACTIVE" && listing.sellerId !== session?.user?.id)) {
    notFound();
  }

  await prisma.listing.update({ where: { id: listing.id }, data: { viewCount: { increment: 1 } } }).catch(() => null);

  const [ratingAgg, similar] = await Promise.all([
    prisma.review.aggregate({
      where: { subjectId: listing.sellerId },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.listing.findMany({
      where: { category: listing.category, status: "ACTIVE", id: { not: listing.id } },
      take: 4,
      orderBy: { createdAt: "desc" },
      select: listingCardSelect,
    }),
  ]);

  const similarWithFavs = await attachFavorites(similar, session?.user?.id);

  const isPendingReview = listing.status === "PENDING_REVIEW";
  const isRejected = listing.status === "REJECTED";
  const isOwner = session?.user?.id === listing.sellerId;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description.slice(0, 500),
    image: listing.images.map((i) => i.url),
    offers: {
      "@type": "Offer",
      priceCurrency: "NZD",
      price: (listing.priceCents / 100).toFixed(2),
      availability:
        listing.quantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition:
        listing.condition === "MINT" || listing.condition === "NEAR_MINT"
          ? "https://schema.org/NewCondition"
          : "https://schema.org/UsedCondition",
      seller: { "@type": "Person", name: listing.seller.displayName ?? listing.seller.fullName },
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      {isOwner && (isPendingReview || isRejected) && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {isPendingReview
            ? "This listing is awaiting moderator approval and is only visible to you until it's approved."
            : `This listing was rejected${listing.rejectionNote ? `: ${listing.rejectionNote}` : "."} Edit and resubmit from your seller dashboard.`}
        </div>
      )}

      <nav className="text-xs text-muted-2 mb-6">
        <Link href="/marketplace" className="hover:text-gold">
          Marketplace
        </Link>{" "}
        / <span className="text-muted">{CATEGORY_LABELS[listing.category]}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">
        <div>
          <ImageGallery images={listing.images} title={listing.title} />

          <div className="mt-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="outline">{CATEGORY_LABELS[listing.category]}</Badge>
              {listing.gradingCompany ? (
                <GradingBadge company={listing.gradingCompany} grade={listing.grade} />
              ) : listing.condition ? (
                <ConditionBadge condition={listing.condition} />
              ) : null}
              <Badge variant="outline">{LANGUAGE_LABELS[listing.language]}</Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">{listing.title}</h1>
            {listing.setName && <p className="text-muted mt-1">{listing.setName}{listing.cardNumber ? ` · #${listing.cardNumber}` : ""}</p>}

            <div className="flex items-center gap-4 text-xs text-muted-2 mt-3">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {listing.region ?? listing.country}
              </span>
              <span>Listed {formatDate(listing.createdAt)}</span>
              <span>{listing.viewCount} views</span>
            </div>

            <div className="gold-divider my-6" />

            <h2 className="font-semibold mb-2">Description</h2>
            <p className="text-sm text-muted whitespace-pre-line leading-relaxed">{listing.description}</p>

            {listing.category === "GRADED_SLAB" ? (
              <div className="mt-6 rounded-md border border-white/10 p-4">
                <h3 className="text-sm font-semibold mb-3">Grading Details</h3>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-2 text-xs">Grading company</dt>
                    <dd>{listing.gradingCompany}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-2 text-xs">Grade</dt>
                    <dd>{listing.grade}</dd>
                  </div>
                  {listing.certificationNumber && (
                    <div className="col-span-2">
                      <dt className="text-muted-2 text-xs">Certification number</dt>
                      <dd>{listing.certificationNumber}</dd>
                    </div>
                  )}
                </dl>
                {listing.slabDamageNotes ? (
                  <div className="mt-3 flex items-start gap-2 text-sm text-warning">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{listing.slabDamageNotes}</span>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-success">No slab damage disclosed by seller.</p>
                )}
              </div>
            ) : (
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-2">Condition Disclosure</h3>
                <DefectDisclosure listing={listing} />
              </div>
            )}

            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <div className="rounded-md border border-white/10 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-1">
                  <Truck className="h-4 w-4 text-gold" /> Shipping
                </h3>
                <p className="text-sm text-muted">
                  {listing.offersDelivery ? "Tracked shipping available across NZ." : "No delivery offered."}
                  {listing.offersPickup && " Local pickup available."}
                </p>
              </div>
              <div className="rounded-md border border-white/10 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-1">
                  <RotateCcw className="h-4 w-4 text-gold" /> Returns
                </h3>
                <p className="text-sm text-muted">{listing.returnPolicy || "This seller has not specified a return policy — see our platform Refund Policy."}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs text-muted-2">
              <Package className="h-3.5 w-3.5" />
              {`Wots TCG Vault NZ`} does not independently authenticate items unless graded by an
              official third-party grading company. Buy from verified sellers and review photos
              carefully.
            </div>

            <div className="mt-6">
              <ReportListingButton listingId={listing.id} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {!isOwner && (
            <BuyBox
              listingId={listing.id}
              priceCents={listing.priceCents}
              quantity={listing.quantity}
              offersPickup={listing.offersPickup}
              shippingOptions={listing.shippingOptions}
            />
          )}
          <SellerCard
            listingId={listing.id}
            seller={{
              id: listing.seller.id,
              username: listing.seller.username,
              displayName: listing.seller.displayName,
              fullName: listing.seller.fullName,
              avatarUrl: listing.seller.avatarUrl,
              location: listing.seller.location,
              isEmailVerified: listing.seller.isEmailVerified,
              isFacebookLinked: listing.seller.isFacebookLinked,
              isIdVerified: listing.seller.isIdVerified,
              isTrustedSeller: listing.seller.isTrustedSeller,
              joinedAt: listing.seller.joinedAt,
              facebookConnection: listing.seller.facebookConnection
                ? {
                    profileUrl: listing.seller.facebookConnection.profileUrl,
                    publicConsent: listing.seller.facebookConnection.publicConsent,
                  }
                : null,
              avgRating: ratingAgg._avg.rating,
              reviewCount: ratingAgg._count.rating,
              activeListingCount: listing.seller._count.listings,
            }}
          />
        </div>
      </div>

      {similarWithFavs.length > 0 && (
        <div className="mt-16">
          <ListingRail
            title="Similar Listings"
            listings={similarWithFavs}
            href={`/marketplace?category=${listing.category}`}
            emptyMessage=""
          />
        </div>
      )}
    </div>
  );
}
