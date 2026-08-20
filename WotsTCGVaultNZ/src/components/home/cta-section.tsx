"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-br from-surface to-charcoal p-10 sm:p-16 text-center"
      >
        <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-gold/20 blur-[100px]" />
        <h2 className="relative text-2xl sm:text-4xl font-display font-bold mb-4">
          Ready to join <span className="text-gold-gradient">the Vault?</span>
        </h2>
        <p className="relative text-muted max-w-xl mx-auto mb-8">
          Whether you&apos;re chasing your next grail or clearing out a collection, Wots TCG
          Vault NZ gives you a premium, secure place to trade.
        </p>
        <div className="relative flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/register">Create Your Account</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/marketplace">Explore Listings</Link>
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
