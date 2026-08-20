"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Layers,
  Gem,
  Package,
  Box,
  PackageOpen,
  Archive,
  Sparkle,
  ShoppingBag,
  MoreHorizontal,
} from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/constants";
import type { ListingCategory } from "@prisma/client";

const ICONS: Record<ListingCategory, React.ElementType> = {
  SINGLE_CARD: Layers,
  GRADED_SLAB: Gem,
  SEALED_PRODUCT: Package,
  BOOSTER_BOX: Box,
  BOOSTER_PACK: PackageOpen,
  ELITE_TRAINER_BOX: Archive,
  COLLECTION: Sparkle,
  ACCESSORIES: ShoppingBag,
  OTHER: MoreHorizontal,
};

export function CategoryGrid() {
  const categories = Object.keys(CATEGORY_LABELS) as ListingCategory[];

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold">Browse by Category</h2>
          <p className="text-muted mt-1 text-sm">Find exactly what you&apos;re hunting for.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {categories.map((cat, i) => {
          const Icon = ICONS[cat];
          return (
            <motion.div
              key={cat}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
            >
              <Link
                href={`/marketplace?category=${cat}`}
                className="card-luxury flex flex-col items-center justify-center gap-3 p-6 text-center h-32 group"
              >
                <Icon className="h-6 w-6 text-gold group-hover:scale-110 transition-transform" />
                <span className="text-sm text-foreground/90">{CATEGORY_LABELS[cat]}</span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
