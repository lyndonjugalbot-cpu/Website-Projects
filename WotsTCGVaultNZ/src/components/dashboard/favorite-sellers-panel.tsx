"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Seller = {
  username: string;
  displayName: string | null;
  fullName: string;
  avatarUrl: string | null;
  isIdVerified: boolean;
  _count: { listings: number };
};

export function FavoriteSellersPanel() {
  const [sellers, setSellers] = React.useState<Seller[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/favorite-sellers")
      .then((res) => res.json())
      .then((data) => setSellers(data.sellers ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-muted-2">Loading favorite sellers…</p>;
  if (sellers.length === 0) return <p className="text-sm text-muted-2">You&apos;re not following any sellers yet.</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sellers.map((s) => (
        <Link key={s.username} href={`/profile/${s.username}`} className="card-luxury p-4 flex items-center gap-3">
          <Avatar>
            <AvatarImage src={s.avatarUrl ?? undefined} alt="" />
            <AvatarFallback>{(s.displayName ?? s.fullName).slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium flex items-center gap-1 truncate">
              {s.displayName ?? s.fullName}
              {s.isIdVerified && <ShieldCheck className="h-3.5 w-3.5 text-gold shrink-0" />}
            </p>
            <p className="text-xs text-muted-2">@{s.username} · {s._count.listings} active listings</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
