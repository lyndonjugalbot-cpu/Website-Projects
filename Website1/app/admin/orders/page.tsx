// ⚠️ Sample/demo page — this route has NO authentication or authorization.
// Anyone who knows the URL can view every customer's order and contact
// details. Before deploying this anywhere real, put this whole /admin
// section behind auth (e.g. NextAuth, Clerk, or a simple middleware-based
// password gate) — see README "Before going live".

import { listOrders } from "@/lib/orders";
import { formatCentavosAsPHP } from "@/lib/money";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminOrdersPage() {
  const orders = await listOrders();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Orders</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {orders.length} order{orders.length === 1 ? "" : "s"} — demo admin view, no authentication.
      </p>

      {orders.length === 0 ? (
        <p className="mt-10 text-neutral-500">No orders yet.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-neutral-100 last:border-b-0">
                  <td className="px-4 py-3 font-mono text-xs text-neutral-500">{order.id.slice(0, 10)}&hellip;</td>
                  <td className="px-4 py-3">
                    <div className="text-neutral-900">{order.customerName}</div>
                    <div className="text-xs text-neutral-500">{order.email}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {order.items.reduce((n, i) => n + i.quantity, 0)} item
                    {order.items.reduce((n, i) => n + i.quantity, 0) === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {formatCentavosAsPHP(order.totalCentavos)}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {order.paymentMethod ? order.paymentMethod.toUpperCase() : "—"}
                    {order.isMockPayment && " (mock)"}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-neutral-500">
                    {dateFormatter.format(order.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
