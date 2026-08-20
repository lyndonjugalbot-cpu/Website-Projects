"use client";

import * as React from "react";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/shared/badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatNZD } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus } from "@prisma/client";

type Order = {
  id: string;
  status: OrderStatus;
  totalCents: number;
  platformFeeCents: number;
  createdAt: string;
  buyer: { username: string; email: string };
  items: { titleSnapshot: string; quantity: number }[];
  payment: { status: string } | null;
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [status, setStatus] = React.useState<string>("all");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/orders${status !== "all" ? `?status=${status}` : ""}`)
      .then((res) => res.json())
      .then((data) => setOrders(data.orders ?? []))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold">Orders</h2>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-2">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-2">No orders found.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/admin/orders/${o.id}`}
              className="card-luxury p-4 flex flex-wrap items-center gap-3 hover:border-gold/30 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">#{o.id.slice(-8)} — {o.items.map((i) => i.titleSnapshot).join(", ")}</p>
                <p className="text-xs text-muted-2">
                  @{o.buyer.username} · {formatDate(o.createdAt)} · {formatNZD(o.totalCents)} (fee {formatNZD(o.platformFeeCents)})
                </p>
              </div>
              <OrderStatusBadge status={o.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
