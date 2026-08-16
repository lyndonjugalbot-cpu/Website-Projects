import Link from "next/link";
import { listOrders } from "@/lib/orders";
import { formatCentavosAsPHP } from "@/lib/money";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/OrderStatusBadge";
import type { OrderStatus, PaymentStatus } from "@/lib/types";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/types";
import { OrderFilters } from "@/components/admin/OrderFilters";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { search?: string; orderStatus?: string; paymentStatus?: string };
}) {
  const orders = await listOrders({
    search: searchParams.search,
    orderStatus: searchParams.orderStatus,
    paymentStatus: searchParams.paymentStatus,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Orders</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {orders.length} order{orders.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <OrderFilters
        search={searchParams.search}
        orderStatus={searchParams.orderStatus}
        paymentStatus={searchParams.paymentStatus}
      />

      {orders.length === 0 ? (
        <p className="mt-10 text-neutral-500">No orders match these filters.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Order status</th>
                <th className="px-4 py-3 font-medium">Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${order.id}`} className="font-mono text-xs text-brand-red hover:underline">
                      {order.id.slice(0, 10)}&hellip;
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-neutral-900">{order.customerName}</div>
                    <div className="text-xs text-neutral-500">{order.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {order.items.reduce((n, i) => n + i.quantity, 0)} item
                    {order.items.reduce((n, i) => n + i.quantity, 0) === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{formatCentavosAsPHP(order.totalCentavos)}</td>
                  <td className="px-4 py-3">
                    <PaymentStatusBadge status={order.paymentStatus as PaymentStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.orderStatus as OrderStatus} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-neutral-500">{dateFormatter.format(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-neutral-400">
        Order statuses: {Object.values(ORDER_STATUS_LABELS).join(", ")}. Payment statuses:{" "}
        {Object.values(PAYMENT_STATUS_LABELS).join(", ")}.
      </p>
    </div>
  );
}
