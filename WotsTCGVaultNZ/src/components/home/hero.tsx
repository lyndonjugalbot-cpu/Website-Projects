"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { motion } from "framer-motion";
import { Search, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Hero() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/marketplace${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  }

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-60">
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gold/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-xs text-gold-light mb-6"
        >
          <Sparkles className="h-3.5 w-3.5" /> New Zealand&apos;s premium TCG marketplace
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-4xl sm:text-6xl font-display font-bold tracking-tight leading-[1.05]"
        >
          Buy and sell{" "}
          <span className="text-gold-gradient">graded slabs, singles,</span>
          <br className="hidden sm:block" /> and sealed product with confidence.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-muted"
        >
          A curated, verified marketplace for Pokémon and trading card collectors across
          Aotearoa — ID-verified sellers, secure NZD payments, and tracked shipping.
        </motion.p>

        <motion.form
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          onSubmit={onSearch}
          className="mx-auto mt-10 flex max-w-xl items-center gap-2 rounded-full border border-gold/25 bg-surface p-1.5 shadow-2xl shadow-black/40"
        >
          <Search className="ml-3 h-4 w-4 text-muted-2 shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for Charizard, PSA 10, booster box..."
            className="border-0 bg-transparent focus-visible:ring-0 h-10"
            aria-label="Search the marketplace"
          />
          <Button type="submit" className="rounded-full shrink-0">
            Search
          </Button>
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.28 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gold" /> ID-verified sellers
          </span>
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gold" /> Secure NZD checkout
          </span>
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" /> Curated authenticity checks
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.34 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Button asChild size="lg">
            <Link href="/marketplace">Browse the Vault</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/sell/new">Start Selling</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
