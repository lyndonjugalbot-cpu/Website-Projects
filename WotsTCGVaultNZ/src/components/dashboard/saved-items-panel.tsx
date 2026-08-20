"use client";

import * as React from "react";
import { ListingCard } from "@/components/marketplace/listing-card";
import type { ListingCardData } from "@/types/listing";

export function SavedItemsPanel() {
  const [listings, setListings] = React.useState<ListingCardData[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/favorites")
      .then((res) => res.json())
      .then((data) => setListings(data.listings ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-muted-2">Loading saved items…</p>;
  if (listings.length === 0) return <p className="text-sm text-muted-2">You haven&apos;t saved any items yet.</p>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {listings.map((l, i) => (
        <ListingCard key={l.id} listing={l} index={i} />
      ))}
    </div>
  );
}
