"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { CartIconLink } from "@/components/CartIconLink";
import { BUSINESS_HOURS, DELIVERY_AREAS, STORE_NAME } from "@/lib/store-config";

const NAV_LINKS = [
  { href: "/products", label: "Shop" },
  { href: "/points", label: "Rewards" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) return null;

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-brand-red text-[11px] font-medium tracking-wide text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <p className="truncate">
            <span className="font-semibold text-brand-gold">Delivering</span> to {DELIVERY_AREAS}
          </p>
          <p className="hidden truncate sm:block">{BUSINESS_HOURS}</p>
        </div>
      </div>

      <div className="border-b border-white/10 bg-brand-black/90 text-white backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label={`${STORE_NAME} home`}>
            <Image src="/brand/logo.png" alt="" width={140} height={120} className="h-10 w-auto" priority />
            <span className="hidden font-display text-lg font-semibold tracking-tight text-white sm:inline">
              {STORE_NAME}
            </span>
          </Link>

          <nav className="hidden items-center gap-8 sm:flex" aria-label="Main">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`relative py-1 text-sm font-medium transition after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-brand-gold after:transition-transform after:duration-300 ${
                  isActive(link.href)
                    ? "text-brand-gold after:scale-x-100"
                    : "text-neutral-300 after:scale-x-0 hover:text-white hover:after:scale-x-100"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <CartIconLink />
            <button
              type="button"
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((v) => !v)}
              className="inline-flex items-center justify-center rounded-full p-2 text-white transition hover:bg-white/10 active:scale-95 sm:hidden"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-6 w-6"
              >
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <nav className="animate-fade-in border-t border-white/10 px-4 py-4 sm:hidden" aria-label="Mobile">
            <ul className="flex flex-col gap-4">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="block font-display text-2xl text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}
