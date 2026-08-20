"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShieldCheck,
  ListChecks,
  Users,
  Package,
  Flag,
  Scale,
  Settings,
  FileClock,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/verifications", label: "ID Verifications", icon: ShieldCheck },
  { href: "/admin/listings", label: "Listings", icon: ListChecks },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/payouts", label: "Payouts", icon: Banknote },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/disputes", label: "Disputes", icon: Scale },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: FileClock },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors",
              active ? "bg-gold text-black font-medium" : "text-muted hover:bg-white/5 hover:text-foreground"
            )}
          >
            <link.icon className="h-4 w-4" /> {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
