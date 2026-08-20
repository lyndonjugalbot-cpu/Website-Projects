"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNZD } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/constants";
import type { ListingStatus, ListingCategory } from "@prisma/client";

type Listing = {
  id: string;
  title: string;
  slug: string;
  status: ListingStatus;
  category: ListingCategory;
  priceCents: number;
  quantity: number;
  rejectionNote: string | null;
  images: { url: string }[];
};

const STATUS_TONE: Record<ListingStatus, "success" | "warning" | "danger" | "default" | "outline"> = {
  DRAFT: "outline",
  PENDING_REVIEW: "warning",
  ACTIVE: "success",
  PAUSED: "outline",
  SOLD: "default",
  REMOVED: "danger",
  REJECTED: "danger",
};

export function ListingsManager() {
  const [listings, setListings] = React.useState<Listing[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/listings/mine")
      .then((res) => res.json())
      .then((data) => setListings(data.listings ?? []))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => load(), [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error("Could not update listing.");
      return;
    }
    toast.success("Listing updated.");
    load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/listings/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete listing.");
      return;
    }
    toast.success("Listing deleted.");
    load();
  }

  if (loading) return <p className="text-sm text-muted-2">Loading listings…</p>;
  if (listings.length === 0) {
    return (
      <div className="card-luxury p-10 text-center">
        <p className="text-muted mb-4">You haven&apos;t created any listings yet.</p>
        <Button asChild>
          <Link href="/sell/new">Create your first listing</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {listings.map((l) => (
        <div key={l.id} className="card-luxury p-4 flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0 rounded-md overflow-hidden bg-charcoal">
            {l.images[0] && <Image src={l.images[0].url} alt="" fill sizes="64px" className="object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <Link href={`/listing/${l.slug}`} className="font-medium text-sm hover:text-gold-light line-clamp-1">
              {l.title}
            </Link>
            <p className="text-xs text-muted-2">
              {CATEGORY_LABELS[l.category]} · {formatNZD(l.priceCents)} · Qty {l.quantity}
            </p>
            {l.status === "REJECTED" && l.rejectionNote && (
              <p className="text-xs text-danger mt-1">Rejected: {l.rejectionNote}</p>
            )}
          </div>
          <Badge variant={STATUS_TONE[l.status]}>{l.status.replace("_", " ")}</Badge>
          <div className="flex items-center gap-1 shrink-0">
            {l.status === "ACTIVE" && (
              <Button variant="ghost" size="icon" title="Pause" onClick={() => patch(l.id, { status: "PAUSED" })}>
                <EyeOff className="h-4 w-4" />
              </Button>
            )}
            {l.status === "PAUSED" && (
              <Button variant="ghost" size="icon" title="Resume" onClick={() => patch(l.id, { status: "ACTIVE" })}>
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {(l.status === "ACTIVE" || l.status === "PAUSED") && (
              <Button variant="ghost" size="icon" title="Mark sold" onClick={() => patch(l.id, { status: "SOLD" })}>
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(l.id)}>
              <Trash2 className="h-4 w-4 text-danger" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
