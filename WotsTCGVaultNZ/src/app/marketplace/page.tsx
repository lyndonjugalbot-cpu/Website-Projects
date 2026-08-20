import { Suspense } from "react";
import type { Metadata } from "next";
import { MarketplaceView } from "@/components/marketplace/marketplace-view";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Browse Pokémon singles, graded slabs, sealed product and more from verified NZ sellers.",
};

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-10 text-muted">Loading marketplace…</div>}>
      <MarketplaceView />
    </Suspense>
  );
}
