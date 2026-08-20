"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Package, ShieldAlert, Star, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { OrderStatusBadge } from "@/components/shared/badges";
import { formatDate, formatNZD } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";

type OrderItem = {
  id: string;
  titleSnapshot: string;
  priceCents: number;
  quantity: number;
  listing: { slug: string; images: { url: string }[] };
};

type Order = {
  id: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: string;
  inspectionEndAt: string | null;
  items: OrderItem[];
  buyer?: { username: string; fullName: string };
  shipment: { carrier: string | null; trackingNumber: string | null; status: string } | null;
  dispute: { id: string; status: string; reason: string } | null;
};

export function OrdersManager({ as }: { as: "buyer" | "seller" }) {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [trackingOrder, setTrackingOrder] = React.useState<Order | null>(null);
  const [reviewOrder, setReviewOrder] = React.useState<Order | null>(null);
  const [disputeOrder, setDisputeOrder] = React.useState<Order | null>(null);
  const [respondOrder, setRespondOrder] = React.useState<Order | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/orders?as=${as}`)
      .then((res) => res.json())
      .then((data) => setOrders(data.orders ?? []))
      .finally(() => setLoading(false));
  }, [as]);

  React.useEffect(() => load(), [load]);

  async function confirmDelivery(orderId: string) {
    const res = await fetch(`/api/orders/${orderId}/confirm`, { method: "POST" });
    if (!res.ok) {
      toast.error("Could not confirm delivery.");
      return;
    }
    toast.success("Delivery confirmed — thanks!");
    load();
  }

  if (loading) return <p className="text-sm text-muted-2">Loading orders…</p>;
  if (orders.length === 0) return <p className="text-sm text-muted-2">No orders yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => (
        <div key={order.id} className="card-luxury p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-xs text-muted-2">Order #{order.id.slice(-8)}</p>
              <p className="text-xs text-muted-2">{formatDate(order.createdAt)}</p>
              {as === "seller" && order.buyer && (
                <p className="text-xs text-muted-2">Buyer: @{order.buyer.username}</p>
              )}
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          <div className="flex flex-col gap-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 rounded bg-charcoal overflow-hidden">
                  {item.listing.images[0] && (
                    <Image src={item.listing.images[0].url} alt="" fill sizes="48px" className="object-cover" />
                  )}
                </div>
                <Link href={`/listing/${item.listing.slug}`} className="text-sm flex-1 hover:text-gold-light line-clamp-1">
                  {item.titleSnapshot} × {item.quantity}
                </Link>
                <span className="text-sm text-muted">{formatNZD(item.priceCents * item.quantity)}</span>
              </div>
            ))}
          </div>

          {order.status === "INSPECTION_PERIOD" && order.inspectionEndAt && (
            <div className="mt-3 flex items-center gap-2 text-xs text-success bg-success/5 border border-success/20 rounded-md px-3 py-2">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              Buyer protection period active — report a problem before{" "}
              {new Date(order.inspectionEndAt).toLocaleString("en-NZ")} or the seller becomes eligible for payout.
            </div>
          )}
          {order.status === "ADMIN_REVIEW" && (
            <div className="mt-3 flex items-center gap-2 text-xs text-warning bg-warning/5 border border-warning/20 rounded-md px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              This order is under manual review by our team.
            </div>
          )}
          {as === "seller" && order.dispute && order.status === "DISPUTED" && (
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-danger bg-danger/5 border border-danger/20 rounded-md px-3 py-2">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Dispute open ({order.dispute.reason.replace(/_/g, " ").toLowerCase()}). Your payout is on hold.
              </span>
              {order.dispute.status === "SELLER_RESPONSE_REQUIRED" && (
                <Button size="sm" variant="outline" onClick={() => setRespondOrder(order)}>
                  Respond
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
            <span className="text-sm font-medium">Total: {formatNZD(order.totalCents)}</span>
            <div className="flex items-center gap-2">
              {order.shipment?.trackingNumber && (
                <span className="text-xs text-muted-2 flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" /> {order.shipment.carrier} {order.shipment.trackingNumber}
                </span>
              )}
              {as === "seller" && order.status === "AWAITING_SHIPMENT" && (
                <Button size="sm" variant="outline" onClick={() => setTrackingOrder(order)}>
                  <Package className="h-3.5 w-3.5" /> Add tracking
                </Button>
              )}
              {as === "buyer" && (order.status === "SHIPPED" || order.status === "IN_TRANSIT") && (
                <Button size="sm" onClick={() => confirmDelivery(order.id)}>
                  Confirm delivery
                </Button>
              )}
              {as === "buyer" &&
                ["SHIPPED", "IN_TRANSIT", "DELIVERED", "INSPECTION_PERIOD"].includes(order.status) && (
                  <Button size="sm" variant="ghost" onClick={() => setDisputeOrder(order)}>
                    <AlertTriangle className="h-3.5 w-3.5" /> Report a problem
                  </Button>
                )}
              {as === "buyer" && order.status === "COMPLETED" && (
                <Button size="sm" variant="outline" onClick={() => setReviewOrder(order)}>
                  <Star className="h-3.5 w-3.5" /> Leave review
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}

      <TrackingDialog order={trackingOrder} onClose={() => setTrackingOrder(null)} onSaved={load} />
      <ReviewDialog order={reviewOrder} onClose={() => setReviewOrder(null)} onSaved={load} />
      <DisputeDialog order={disputeOrder} onClose={() => setDisputeOrder(null)} onSaved={load} />
      <RespondDialog order={respondOrder} onClose={() => setRespondOrder(null)} onSaved={load} />
    </div>
  );
}

function RespondDialog({ order, onClose, onSaved }: { order: Order | null; onClose: () => void; onSaved: () => void }) {
  const [response, setResponse] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    if (!order?.dispute || response.trim().length < 10) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/disputes/${order.dispute.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not submit response.");
        return;
      }
      toast.success("Response submitted — our team will review shortly.");
      setResponse("");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(order)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Respond to dispute</DialogTitle>
        </DialogHeader>
        <Textarea
          rows={5}
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Explain your side — shipping proof, item condition at time of sale, etc."
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || response.trim().length < 10}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Submit response
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TrackingDialog({
  order,
  onClose,
  onSaved,
}: {
  order: Order | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [carrier, setCarrier] = React.useState("");
  const [trackingNumber, setTrackingNumber] = React.useState("");
  const [trackingUrl, setTrackingUrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!order) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrier, trackingNumber, trackingUrl, hasInsurance: false }),
      });
      if (!res.ok) {
        toast.error("Could not save tracking.");
        return;
      }
      toast.success("Tracking added — buyer notified.");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(order)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add shipment tracking</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label>Carrier</Label>
            <Input className="mt-1.5" placeholder="NZ Post, Aramex, etc." value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          </div>
          <div>
            <Label>Tracking number</Label>
            <Input className="mt-1.5" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
          </div>
          <div>
            <Label>Tracking URL (optional)</Label>
            <Input className="mt-1.5" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !carrier || !trackingNumber}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save tracking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const DISPUTE_REASONS = [
  { value: "NOT_AS_DESCRIBED", label: "Item not as described" },
  { value: "SUSPECTED_COUNTERFEIT", label: "Suspected counterfeit" },
  { value: "DAMAGED", label: "Item arrived damaged" },
  { value: "MISSING_OR_INCORRECT_ITEM", label: "Missing or incorrect item" },
  { value: "NOT_RECEIVED", label: "Never received" },
  { value: "OTHER", label: "Other" },
];

function DisputeDialog({ order, onClose, onSaved }: { order: Order | null; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    if (!order || !reason || description.trim().length < 10) return;
    setSaving(true);
    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, reason, description }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not open dispute.");
        return;
      }
      toast.success("Dispute opened — the seller's payout is on hold while we review.");
      setReason("");
      setDescription("");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(order)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report a problem with this order</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label>Reason</Label>
            <select
              className="mt-1.5 flex h-10 w-full rounded-md border border-white/10 bg-surface px-3.5 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">Select a reason</option>
              {DISPUTE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Details</Label>
            <Textarea
              className="mt-1.5"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what's wrong — include as much detail as possible."
            />
          </div>
          <p className="text-xs text-muted-2">
            Opening a dispute places the seller&apos;s payout on hold until it&apos;s resolved. The
            seller will be asked to respond within 3 days.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={saving || !reason || description.trim().length < 10}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Submit dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({
  order,
  onClose,
  onSaved,
}: {
  order: Order | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!order) return;
    setSaving(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, rating, comment }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not submit review.");
        return;
      }
      toast.success("Review submitted!");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(order)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave a review</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                <Star className={`h-6 w-6 ${n <= rating ? "fill-gold text-gold" : "text-muted-2"}`} />
              </button>
            ))}
          </div>
          <Textarea placeholder="How was your experience?" value={comment} onChange={(e) => setComment(e.target.value)} rows={4} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Submit review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
