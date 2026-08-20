"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type Report = {
  id: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
  reporter: { username: string };
  reportedUser: { username: string; status: string } | null;
  listing: { title: string; slug: string; status: string } | null;
};

export default function AdminReportsPage() {
  const [reports, setReports] = React.useState<Report[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/admin/reports?status=OPEN")
      .then((res) => res.json())
      .then((data) => setReports(data.reports ?? []))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => load(), [load]);

  async function resolve(id: string, resolveStatus: "ACTIONED" | "DISMISSED") {
    const res = await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: resolveStatus }),
    });
    if (!res.ok) {
      toast.error("Could not resolve report.");
      return;
    }
    toast.success("Report resolved.");
    load();
  }

  if (loading) return <p className="text-sm text-muted-2">Loading…</p>;
  if (reports.length === 0) return <p className="text-sm text-muted-2">No open reports.</p>;

  return (
    <div className="flex flex-col gap-3">
      {reports.map((r) => (
        <div key={r.id} className="card-luxury p-4">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline">{r.reason.replace(/_/g, " ")}</Badge>
            <span className="text-xs text-muted-2">{formatDate(r.createdAt)}</span>
          </div>
          <p className="text-sm text-muted mb-2">{r.details}</p>
          <p className="text-xs text-muted-2 mb-3">
            Reported by @{r.reporter.username}
            {r.reportedUser && (
              <>
                {" "}
                — user{" "}
                <Link href={`/profile/${r.reportedUser.username}`} className="text-gold hover:underline">
                  @{r.reportedUser.username}
                </Link>
              </>
            )}
            {r.listing && (
              <>
                {" "}
                — listing{" "}
                <Link href={`/listing/${r.listing.slug}`} className="text-gold hover:underline">
                  {r.listing.title}
                </Link>
              </>
            )}
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => resolve(r.id, "ACTIONED")}>
              <Check className="h-3.5 w-3.5" /> Mark actioned
            </Button>
            <Button size="sm" variant="ghost" onClick={() => resolve(r.id, "DISMISSED")}>
              <X className="h-3.5 w-3.5" /> Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
