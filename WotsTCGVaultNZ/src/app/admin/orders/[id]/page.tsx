"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { OrderStatusBadge, PayoutStatusBadge, DisputeStatusBadge } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNZD } from "@/lib/utils";

type Transaction = {
  order: {
    id: string;
    status: string;
    subtotalCents: number;
    shippingCents: number;
    platformFeeCents: number;
    totalCents: number;
    createdAt: string;
    paidAt: string | null;
    deliveredAt: string | null;
    inspectionEndAt: string | null;
    completedAt: string | null;
    adminReviewNote: string | null;
    buyer: { username: string; fullName: string; email: string };
    items: { id: string; titleSnapshot: string; priceCents: number; quantity: number; listing: { title: string; slug: string } }[];
    payment: {
      status: string;
      stripeCheckoutSessionId: string | null;
      stripePaymentIntentId: string | null;
      stripeChargeId: string | null;
      amountCents: number;
      refundedAmountCents: number;
    } | null;
    shipment: { carrier: string | null; trackingNumber: string | null; status: string } | null;
    refunds: { id: string; amountCents: number; status: string; type: string; reason: string; stripeRefundId: string | null; createdAt: string }[];
    dispute: { id: string; status: string; reason: string; description: string } | null;
    transfers: { id: string; stripeTransferId: string | null; amountCents: number; status: string; reversedCents: number }[];
  };
  sellers: { id: string; username: string; fullName: string; email: string }[];
  payouts: { id: string; sellerId: string; amountCents: number; status: string; paidAt: string | null; scheduledFor: string | null }[];
  auditLogs: { id: string; action: string; createdAt: string; actor: { username: string } | null; metadata: unknown }[];
};

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = React.useState<Transaction | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/admin/transactions/${id}`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-sm text-muted-2">Loading…</p>;
  if (!data) return <p className="text-sm text-muted-2">Order not found.</p>;
  const { order, sellers, payouts, auditLogs } = data;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Link href="/admin/orders" className="flex items-center gap-1.5 text-xs text-muted hover:text-gold-light">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to orders
      </Link>

      <div className="card-luxury p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Order #{order.id.slice(-8)}</h2>
          <OrderStatusBadge status={order.status as never} />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-2">Buyer</dt>
            <dd>@{order.buyer.username} ({order.buyer.email})</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-2">Seller(s)</dt>
            <dd>{sellers.map((s) => `@${s.username}`).join(", ")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-2">Subtotal / Shipping / Platform Fee</dt>
            <dd>{formatNZD(order.subtotalCents)} / {formatNZD(order.shippingCents)} / {formatNZD(order.platformFeeCents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-2">Total</dt>
            <dd className="font-medium">{formatNZD(order.totalCents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-2">Paid / Delivered</dt>
            <dd>{order.paidAt ? formatDate(order.paidAt) : "—"} / {order.deliveredAt ? formatDate(order.deliveredAt) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-2">Inspection ends / Completed</dt>
            <dd>{order.inspectionEndAt ? formatDate(order.inspectionEndAt) : "—"} / {order.completedAt ? formatDate(order.completedAt) : "—"}</dd>
          </div>
        </dl>
        {order.adminReviewNote && (
          <p className="mt-3 text-xs text-warning bg-warning/5 border border-warning/20 rounded-md p-2">{order.adminReviewNote}</p>
        )}
      </div>

      <div className="card-luxury p-5">
        <h3 className="font-semibold mb-3">Stripe objects</h3>
        <dl className="grid grid-cols-1 gap-2 text-xs font-mono">
          <div>Checkout Session: {order.payment?.stripeCheckoutSessionId ?? "—"}</div>
          <div>PaymentIntent: {order.payment?.stripePaymentIntentId ?? "—"}</div>
          <div>Charge: {order.payment?.stripeChargeId ?? "—"}</div>
          <div>Payment status: {order.payment?.status ?? "—"} (refunded {formatNZD(order.payment?.refundedAmountCents ?? 0)})</div>
        </dl>
      </div>

      {order.shipment && (
        <div className="card-luxury p-5">
          <h3 className="font-semibold mb-3">Shipment</h3>
          <p className="text-sm">
            {order.shipment.carrier ?? "No carrier yet"} — {order.shipment.trackingNumber ?? "no tracking number"} (
            {order.shipment.status})
          </p>
        </div>
      )}

      <div className="card-luxury p-5">
        <h3 className="font-semibold mb-3">Payouts &amp; transfers</h3>
        {payouts.length === 0 ? (
          <p className="text-sm text-muted-2">No payout records yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>{formatNZD(p.amountCents)} — @{sellers.find((s) => s.id === p.sellerId)?.username}</span>
                <PayoutStatusBadge status={p.status as never} />
              </div>
            ))}
          </div>
        )}
        {order.transfers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-1 text-xs font-mono text-muted-2">
            {order.transfers.map((t) => (
              <div key={t.id}>
                {t.stripeTransferId ?? "(no id)"} — {formatNZD(t.amountCents)} — {t.status}
                {t.reversedCents > 0 && ` (reversed ${formatNZD(t.reversedCents)})`}
              </div>
            ))}
          </div>
        )}
      </div>

      {order.refunds.length > 0 && (
        <div className="card-luxury p-5">
          <h3 className="font-semibold mb-3">Refunds</h3>
          <div className="flex flex-col gap-2">
            {order.refunds.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span>
                  {formatNZD(r.amountCents)} — {r.type} — {r.reason}
                </span>
                <Badge variant={r.status === "PROCESSED" ? "success" : "warning"}>{r.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {order.dispute && (
        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Dispute</h3>
            <DisputeStatusBadge status={order.dispute.status as never} />
          </div>
          <p className="text-sm text-muted">{order.dispute.description}</p>
          <Link href="/admin/disputes" className="text-xs text-gold hover:underline flex items-center gap-1 mt-2">
            Manage in Disputes queue <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}

      <div className="card-luxury p-5">
        <h3 className="font-semibold mb-3">Audit history</h3>
        {auditLogs.length === 0 ? (
          <p className="text-sm text-muted-2">No audit events yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5 text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex justify-between text-muted-2">
                <span>
                  {log.action} {log.actor ? `by @${log.actor.username}` : "(system)"}
                </span>
                <span>{formatDate(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
