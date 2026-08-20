"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerificationBadges } from "@/components/shared/badges";

export type FeaturedSeller = {
  username: string;
  displayName: string | null;
  fullName: string;
  avatarUrl: string | null;
  location: string | null;
  isIdVerified: boolean;
  isTrustedSeller: boolean;
  isEmailVerified: boolean;
  isFacebookLinked: boolean;
  listingCount: number;
};

export function FeaturedSellers({ sellers }: { sellers: FeaturedSeller[] }) {
  if (sellers.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold">Featured Sellers</h2>
          <p className="text-muted mt-1 text-sm">Trusted, verified members of the vault.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sellers.map((s, i) => (
          <motion.div
            key={s.username}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.35, delay: i * 0.05 }}
          >
            <Link href={`/profile/${s.username}`} className="card-luxury flex flex-col items-center p-6 text-center">
              <Avatar className="h-16 w-16 mb-3">
                <AvatarImage src={s.avatarUrl ?? undefined} alt="" />
                <AvatarFallback>{(s.displayName ?? s.fullName).slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="font-medium flex items-center gap-1">
                {s.displayName ?? s.fullName}
                {s.isIdVerified && <ShieldCheck className="h-3.5 w-3.5 text-gold" />}
              </span>
              <span className="text-xs text-muted-2 mb-3">@{s.username} · {s.location ?? "New Zealand"}</span>
              <VerificationBadges
                emailVerified={s.isEmailVerified}
                facebookLinked={s.isFacebookLinked}
                idVerified={s.isIdVerified}
                trustedSeller={s.isTrustedSeller}
              />
              <span className="mt-3 text-xs text-muted">{s.listingCount} active listings</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
