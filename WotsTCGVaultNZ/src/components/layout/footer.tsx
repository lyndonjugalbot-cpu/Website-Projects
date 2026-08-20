import Link from "next/link";
import { Facebook, Instagram, MessageCircle, ShieldCheck, Mail, MapPin } from "lucide-react";
import { SITE_NAME } from "@/lib/constants";

const FOOTER_LINKS = {
  Marketplace: [
    { href: "/marketplace", label: "Browse All" },
    { href: "/marketplace?category=GRADED_SLAB", label: "Graded Slabs" },
    { href: "/marketplace?category=SEALED_PRODUCT", label: "Sealed Product" },
    { href: "/sell/new", label: "Sell an Item" },
  ],
  Company: [
    { href: "/#how-it-works", label: "How It Works" },
    { href: "/#trust-safety", label: "Trust & Safety" },
    { href: "/legal/seller-guidelines", label: "Seller Guidelines" },
    { href: "/legal/community-guidelines", label: "Community Guidelines" },
  ],
  Policies: [
    { href: "/legal/terms", label: "Terms & Conditions" },
    { href: "/legal/privacy", label: "Privacy Policy" },
    { href: "/legal/refund-policy", label: "Refund Policy" },
    { href: "/legal/prohibited-items", label: "Prohibited Items" },
    { href: "/legal/authenticity-policy", label: "Authenticity Policy" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-gold/10 bg-surface mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <span className="text-2xl text-gold-gradient font-display font-bold">Wots TCG Vault</span>
            <p className="mt-3 text-sm text-muted max-w-xs">
              New Zealand&apos;s premium marketplace for Pokémon cards, graded slabs, sealed
              product and trading card collectibles. Buy and sell with confidence.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-2">
              <MapPin className="h-3.5 w-3.5 text-gold" /> Based in Aotearoa New Zealand
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-2">
              <Mail className="h-3.5 w-3.5 text-gold" /> support@wotstcgvault.co.nz
            </div>
            <div className="mt-5 flex items-center gap-3">
              <a href="#" aria-label="Facebook" className="text-muted hover:text-gold-light transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" aria-label="Instagram" className="text-muted hover:text-gold-light transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" aria-label="Community chat" className="text-muted hover:text-gold-light transition-colors">
                <MessageCircle className="h-5 w-5" />
              </a>
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="text-sm font-semibold text-foreground mb-4">{heading}</h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted hover:text-gold-light transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="gold-divider my-10" />

        <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-2">
            © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-2">
            <ShieldCheck className="h-4 w-4 text-gold" />
            Payments are processed by Stripe. {SITE_NAME} operates a platform-managed payment and
            payout process, not a bank.
          </div>
        </div>
      </div>
    </footer>
  );
}
