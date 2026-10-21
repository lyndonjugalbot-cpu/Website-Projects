"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STORE_NAME, STORE_TAGLINE, FACEBOOK_URL, CONTACT_EMAIL, CONTACT_PHONE, DELIVERY_AREAS } from "@/lib/store-config";

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <footer className="mt-16 border-t border-neutral-200 bg-brand-black text-neutral-300">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="text-base font-semibold text-white">{STORE_NAME}</p>
          <p className="mt-1 text-sm text-neutral-400">{STORE_TAGLINE}</p>
          <p className="mt-3 text-sm text-neutral-400">Delivering to {DELIVERY_AREAS}.</p>
        </div>

        <div className="text-sm">
          <p className="font-medium text-white">Shop</p>
          <ul className="mt-3 flex flex-col gap-2">
            <li><Link href="/products" className="text-neutral-400 hover:text-brand-gold">All products</Link></li>
            <li><Link href="/about" className="text-neutral-400 hover:text-brand-gold">About us</Link></li>
            <li><Link href="/contact" className="text-neutral-400 hover:text-brand-gold">Contact</Link></li>
          </ul>
        </div>

        <div className="text-sm">
          <p className="font-medium text-white">Get in touch</p>
          <ul className="mt-3 flex flex-col gap-2 text-neutral-400">
            <li>
              <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className="hover:text-brand-gold">
                Facebook &rarr;
              </a>
            </li>
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-brand-gold">{CONTACT_EMAIL}</a>
            </li>
            <li>
              <a href={`tel:${CONTACT_PHONE.replace(/\s+/g, "")}`} className="hover:text-brand-gold">{CONTACT_PHONE}</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-5 text-xs text-neutral-500 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} {STORE_NAME}. All rights reserved.</p>
          <Link href="/admin/login" className="hover:text-neutral-300">Staff login</Link>
        </div>
      </div>
    </footer>
  );
}
