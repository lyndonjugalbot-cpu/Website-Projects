"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNZD } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/constants";

type Listing = {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: string;
  priceCents: number;
  images: { url: string }[];
  seller: { username: string; fullName: string; isTrustedSeller: boolean };
};

export default function AdminListingsPage() {
  const [listings, setListings] = React.useState<Listing[]>([]);
  const [status, setStatus] = React.useState("PENDING_REVIEW");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/listings?status=${status}`)
      .then((res) => res.json())
      .then((data) => setListings(data.listings ?? []))
      .finally(() => setLoading(false));
  }, [status]);

  React.useEffect(() => load(), [load]);

  async function act(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error("Action failed.");
      return;
    }
    toast.success("Listing updated.");
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold">Listings</h2>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
            <SelectItem value="SOLD">Sold</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="REMOVED">Removed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-2">Loading…</p>
      ) : listings.length === 0 ? (
        <p className="text-sm text-muted-2">No listings in this status.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {listings.map((l) => (
            <div key={l.id} className="card-luxury p-4 flex items-center gap-4">
              <div className="relative h-14 w-14 shrink-0 rounded bg-charcoal overflow-hidden">
                {l.images[0] && <Image src={l.images[0].url} alt="" fill sizes="56px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/listing/${l.slug}`} className="text-sm font-medium hover:text-gold-light line-clamp-1">
                  {l.title}
                </Link>
                <p className="text-xs text-muted-2">
                  {CATEGORY_LABELS[l.category as keyof typeof CATEGORY_LABELS]} · {formatNZD(l.priceCents)} · @{l.seller.username}
                  {l.seller.isTrustedSeller && <Badge variant="default" className="ml-2">Trusted</Badge>}
                </p>
              </div>
              {status === "PENDING_REVIEW" && (
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => act(l.id, { status: "ACTIVE" })}>
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => act(l.id, { status: "REJECTED", rejectionNote: "Does not meet listing guidelines." })}
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              )}
              {status !== "PENDING_REVIEW" && status !== "REMOVED" && (
                <Button size="sm" variant="ghost" onClick={() => act(l.id, { status: "REMOVED" })}>
                  <Trash2 className="h-3.5 w-3.5 text-danger" /> Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
