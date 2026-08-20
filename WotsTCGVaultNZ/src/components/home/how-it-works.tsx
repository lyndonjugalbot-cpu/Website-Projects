"use client";

import { motion } from "framer-motion";
import { Search, ShieldCheck, CreditCard, Truck } from "lucide-react";

const STEPS = [
  {
    icon: Search,
    title: "Discover",
    body: "Browse verified listings across singles, slabs, sealed product and more — filter by grade, condition and price.",
  },
  {
    icon: CreditCard,
    title: "Buy Securely",
    body: "Pay in NZD through our secure checkout. Funds are held by our payment provider until your order is confirmed.",
  },
  {
    icon: Truck,
    title: "Track & Receive",
    body: "Sellers ship with tracking. Follow your order status right through to delivery at your door.",
  },
  {
    icon: ShieldCheck,
    title: "Confirm & Review",
    body: "Confirm receipt, leave a review, and help build trust across the community.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 scroll-mt-20">
      <div className="text-center mb-12">
        <h2 className="text-2xl sm:text-3xl font-display font-bold">How the Marketplace Works</h2>
        <p className="text-muted mt-2 text-sm max-w-xl mx-auto">
          A simple, secure flow from discovery to delivery — built for collectors, by collectors.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="relative card-luxury p-6"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/30 bg-gold/10 mb-4">
              <step.icon className="h-5 w-5 text-gold" />
            </div>
            <span className="absolute top-6 right-6 text-3xl font-display text-white/5">
              0{i + 1}
            </span>
            <h3 className="font-semibold mb-1.5">{step.title}</h3>
            <p className="text-sm text-muted leading-relaxed">{step.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
