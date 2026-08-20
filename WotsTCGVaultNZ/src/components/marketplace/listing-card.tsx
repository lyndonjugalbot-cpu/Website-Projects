"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, MapPin, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConditionBadge, GradingBadge } from "@/components/shared/badges";
import { CATEGORY_LABELS } from "@/lib/constants";
import { cn, formatNZD, relativeTime } from "@/lib/utils";
import type { ListingCardData } from "@/types/listing";
import { toast } from "sonner";

export function ListingCard({
  listing,
  view = "grid",
  index = 0,
}: {
  listing: ListingCardData;
  view?: "grid" | "list";
  index?: number;
}) {
  const [favorited, setFavorited] = React.useState(Boolean(listing.isFavorited));
  const [pending, setPending] = React.useState(false);
  const frontImage = listing.images.find((i) => i.angle === "FRONT") ?? listing.images[0];

  async function toggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    const next = !favorited;
    setFavorited(next);
    try {
      const res = await fetch("/api/favorites", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setFavorited(!next);
      toast.error("Sign in to save favorites");
    } finally {
      setPending(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className={cn(view === "list" && "w-full")}
    >
      <Link
        href={`/listing/${listing.slug}`}
        className={cn(
          "card-luxury group block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
          view === "list" && "flex gap-4"
        )}
      >
        <div
          className={cn(
            "relative overflow-hidden bg-charcoal",
            view === "grid" ? "aspect-[4/5]" : "w-36 shrink-0 aspect-[4/5] rounded-l-[calc(var(--radius)-1px)]"
          )}
        >
          {frontImage ? (
            <Image
              src={frontImage.url}
              alt={listing.title}
              fill
              sizes="(max-width: 768px) 50vw, 300px"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-2 text-xs">
              No image
            </div>
          )}
          <button
            onClick={toggleFavorite}
            aria-pressed={favorited}
            aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
            className="absolute right-2 top-2 rounded-full bg-black/50 backdrop-blur-md p-2 transition-transform hover:scale-110 active:scale-95"
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-colors",
                favorited ? "fill-gold text-gold" : "text-white"
              )}
            />
          </button>
          <div className="absolute left-2 top-2">
            <Badge variant="outline" className="bg-black/50 backdrop-blur-md border-white/20 text-white">
              {CATEGORY_LABELS[listing.category]}
            </Badge>
          </div>
        </div>

        <div className={cn("p-4 flex flex-col gap-2", view === "list" && "flex-1 py-3")}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-gold-light transition-colors">
              {listing.title}
            </h3>
          </div>
          {listing.setName && <p className="text-xs text-muted-2 line-clamp-1">{listing.setName}</p>}

          <div className="flex flex-wrap items-center gap-1.5">
            {listing.gradingCompany ? (
              <GradingBadge company={listing.gradingCompany} grade={listing.grade} />
            ) : listing.condition ? (
              <ConditionBadge condition={listing.condition} />
            ) : null}
          </div>

          <p className="text-lg font-semibold text-gold-light font-display">
            {formatNZD(listing.priceCents)}
          </p>

          <div className="flex items-center justify-between text-xs text-muted-2 mt-1">
            <span className="flex items-center gap-1 truncate">
              @{listing.seller.username}
              {listing.seller.isIdVerified && <ShieldCheck className="h-3 w-3 text-gold shrink-0" />}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <MapPin className="h-3 w-3" /> {listing.region ?? "NZ"}
            </span>
          </div>
          <p className="text-[11px] text-muted-2">Listed {relativeTime(listing.createdAt)}</p>
        </div>
      </Link>
    </motion.div>
  );
}
