"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Menu, X, Heart, MessageCircle, LayoutDashboard, LogOut, ShieldCheck, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#trust-safety", label: "Trust & Safety" },
  { href: "/legal/seller-guidelines", label: "Seller Guidelines" },
];

export function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/marketplace${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    setMobileOpen(false);
  }

  const initials = (session?.user?.name ?? session?.user?.username ?? "U")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-300",
        scrolled ? "border-b border-gold/15 bg-background/85 backdrop-blur-xl" : "border-b border-transparent bg-background/40 backdrop-blur-sm"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 group">
          <span className="text-2xl leading-none text-gold-gradient font-display font-bold tracking-tight group-hover:opacity-90 transition-opacity">
            Wots
          </span>
          <span className="hidden sm:flex flex-col leading-tight">
            <span className="text-xs tracking-[0.25em] text-muted uppercase">TCG Vault</span>
            <span className="text-[10px] tracking-[0.2em] text-gold/70 uppercase">New Zealand</span>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-6 ml-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted hover:text-gold-light transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-md ml-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards, sets, sellers..."
            className="pl-9"
            aria-label="Search the marketplace"
          />
        </form>

        <div className="hidden lg:flex items-center gap-2 ml-2">
          {session ? (
            <>
              <Button asChild variant="ghost" size="icon" aria-label="Messages">
                <Link href="/messages">
                  <MessageCircle className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon" aria-label="Favorites">
                <Link href="/dashboard/buyer?tab=saved">
                  <Heart className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="sm" className="ml-1">
                <Link href="/sell/new">
                  <PlusCircle className="h-4 w-4" /> Sell
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ml-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50">
                    <Avatar>
                      <AvatarImage src={session.user.image ?? undefined} alt="" />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{session.user.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/profile/${session.user.username}`}>Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/buyer">
                      <LayoutDashboard className="mr-2 h-4 w-4" /> Buyer Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/seller">
                      <LayoutDashboard className="mr-2 h-4 w-4" /> Seller Dashboard
                    </Link>
                  </DropdownMenuItem>
                  {["SUPER_ADMIN", "MODERATOR", "VERIFICATION_REVIEWER", "SUPPORT"].includes(
                    session.user.role
                  ) && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <ShieldCheck className="mr-2 h-4 w-4" /> Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Join the Vault</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="ml-auto lg:hidden text-foreground"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden overflow-hidden border-t border-gold/10 bg-background/95 backdrop-blur-xl"
          >
            <div className="px-4 py-4 flex flex-col gap-4">
              <form onSubmit={submitSearch} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search cards, sets, sellers..."
                  className="pl-9"
                />
              </form>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted hover:text-gold-light"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="gold-divider" />
              {session ? (
                <div className="flex flex-col gap-2">
                  <Button asChild size="sm">
                    <Link href="/sell/new" onClick={() => setMobileOpen(false)}>
                      Create Listing
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard/buyer" onClick={() => setMobileOpen(false)}>
                      Dashboard
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
                    Log out
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      Log in
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="flex-1">
                    <Link href="/register" onClick={() => setMobileOpen(false)}>
                      Join
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
