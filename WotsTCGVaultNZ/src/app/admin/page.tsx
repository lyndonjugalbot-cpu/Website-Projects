"use client";

import * as React from "react";
import { Users, ListChecks, ShieldCheck, Flag, Scale, TrendingUp } from "lucide-react";
import { formatNZD } from "@/lib/utils";

type Stats = {
  userCount: number;
  sellerCount: number;
  activeListings: number;
  pendingListings: number;
  pendingVerifications: number;
  openReports: number;
  openDisputes: number;
  platformRevenueCents: number;
  grossVolumeCents: number;
  orderCounts: Record<string, number>;
};

function StatCard({ icon: Icon, label, value, href }: { icon: React.ElementType; label: string; value: string | number; href?: string }) {
  const Comp = href ? "a" : "div";
  return (
    <Comp href={href} className="card-luxury p-5 flex items-center gap-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/10 border border-gold/30 shrink-0">
        <Icon className="h-5 w-5 text-gold" />
      </div>
      <div>
        <p className="text-2xl font-display font-semibold">{value}</p>
        <p className="text-xs text-muted-2">{label}</p>
      </div>
    </Comp>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = React.useState<Stats | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then(setStats);
  }, []);

  if (!stats) return <p className="text-sm text-muted-2">Loading analytics…</p>;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total Users" value={stats.userCount} href="/admin/users" />
        <StatCard icon={Users} label="Sellers" value={stats.sellerCount} />
        <StatCard icon={ListChecks} label="Active Listings" value={stats.activeListings} href="/admin/listings" />
        <StatCard icon={ListChecks} label="Pending Listing Review" value={stats.pendingListings} href="/admin/listings" />
        <StatCard icon={ShieldCheck} label="Pending ID Verifications" value={stats.pendingVerifications} href="/admin/verifications" />
        <StatCard icon={Flag} label="Open Reports" value={stats.openReports} href="/admin/reports" />
        <StatCard icon={Scale} label="Open Disputes" value={stats.openDisputes} href="/admin/disputes" />
        <StatCard icon={TrendingUp} label="Platform Revenue (completed)" value={formatNZD(stats.platformRevenueCents)} />
        <StatCard icon={TrendingUp} label="Gross Volume (completed)" value={formatNZD(stats.grossVolumeCents)} />
      </div>

      <div className="card-luxury p-5">
        <h2 className="font-semibold mb-4">Orders by Status</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(stats.orderCounts).map(([status, count]) => (
            <div key={status} className="rounded-md border border-white/10 px-3 py-2 text-sm">
              <span className="text-muted-2 mr-2">{status.replace("_", " ")}</span>
              <span className="font-medium">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
