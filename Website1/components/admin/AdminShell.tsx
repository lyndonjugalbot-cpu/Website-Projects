"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import type { UserRole } from "@/generated/prisma/enums";
import { STORE_NAME } from "@/lib/store-config";

type AdminUser = { name: string; email: string; role: UserRole };

const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  STAFF: "Staff",
};

function navLinksFor(role: UserRole) {
  const links = [
    { href: "/admin/pos", label: "POS" },
    { href: "/admin/orders", label: "Orders" },
  ];
  if (role === "OWNER" || role === "MANAGER") {
    links.push(
      { href: "/admin/products", label: "Products" },
      { href: "/admin/inventory", label: "Inventory" },
      { href: "/admin/reports", label: "Reports" }
    );
  }
  if (role === "OWNER") {
    links.push({ href: "/admin/staff", label: "Staff accounts" });
  }
  return links;
}

export function AdminShell({ user, children }: { user: AdminUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const links = navLinksFor(user.role);

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-brand-black">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2">
              <Image src="/brand/logo.png" alt="" width={140} height={120} className="h-8 w-auto" />
              <span className="hidden text-sm font-semibold text-white sm:inline">{STORE_NAME} Admin</span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {links.map((link) => {
                const active = pathname === link.href || pathname?.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                      active ? "bg-brand-red text-white" : "text-neutral-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white">{user.name || user.email}</p>
              <p className="text-xs text-neutral-400">{ROLE_LABELS[user.role]}</p>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-full border border-white/20 px-3.5 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-white/10"
            >
              Sign out
            </button>
            <button
              type="button"
              aria-label="Toggle menu"
              onClick={() => setIsMenuOpen((v) => !v)}
              className="rounded-full p-2 text-neutral-200 hover:bg-white/10 sm:hidden"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              </svg>
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <nav className="flex flex-col gap-1 border-t border-white/10 px-4 py-3 sm:hidden">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-white/10"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
