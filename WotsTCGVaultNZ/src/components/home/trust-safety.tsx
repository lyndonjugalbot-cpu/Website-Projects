"use client";

import { motion } from "framer-motion";
import { BadgeCheck, Lock, ShieldAlert, UserCheck } from "lucide-react";

const POINTS = [
  {
    icon: UserCheck,
    title: "ID-Verified Sellers",
    body: "Every seller submits government ID before they can list — reviewed by our verification team before approval.",
  },
  {
    icon: Lock,
    title: "Secure Payments",
    body: "Payments are processed by Stripe. We never see or store your card details.",
  },
  {
    icon: BadgeCheck,
    title: "Buyer Protection",
    body: "Funds are only released to sellers once you've confirmed delivery, or after the protection window passes.",
  },
  {
    icon: ShieldAlert,
    title: "Report & Moderate",
    body: "Report suspicious listings or users any time — our trust & safety team reviews every report.",
  },
];

export function TrustSafety() {
  return (
    <section id="trust-safety" className="relative py-20 scroll-mt-20">
      <div className="absolute inset-0 -z-10 bg-surface" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-display font-bold">Built on Trust & Safety</h2>
          <p className="text-muted mt-2 text-sm max-w-xl mx-auto">
            We don&apos;t guarantee authenticity unless an item has gone through an official
            grading or authentication process — but we do verify who you&apos;re trading with.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {POINTS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="glass-panel rounded-lg p-6"
            >
              <p.icon className="h-6 w-6 text-gold mb-4" />
              <h3 className="font-semibold mb-1.5">{p.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{p.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
