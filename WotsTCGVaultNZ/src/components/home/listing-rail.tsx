import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ListingCard } from "@/components/marketplace/listing-card";
import type { ListingCardData } from "@/types/listing";

export function ListingRail({
  title,
  subtitle,
  listings,
  href,
  emptyMessage,
}: {
  title: string;
  subtitle?: string;
  listings: ListingCardData[];
  href: string;
  emptyMessage: string;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold">{title}</h2>
          {subtitle && <p className="text-muted mt-1 text-sm">{subtitle}</p>}
        </div>
        <Link
          href={href}
          className="hidden sm:flex items-center gap-1 text-sm text-gold hover:text-gold-light transition-colors shrink-0"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {listings.length === 0 ? (
        <p className="text-sm text-muted-2">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {listings.map((listing, i) => (
            <ListingCard key={listing.id} listing={listing} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
