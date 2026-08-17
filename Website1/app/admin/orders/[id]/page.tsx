import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/orders";
import { formatCentavosAsPHP } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/types";
import { OrderStatusEditor } from "@/components/admin/OrderStatusEditor";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const order = await getOrderById(params.id);
  if (!order) notFound();

  return (
    <div>
      <Link href="/admin/orders" className="text-sm text-neutral-500 hover:text-neutral-800">
        &larr; All orders
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Order <span className="font-mono text-lg text-neutral-500">{order.id}</span>
          <span className="ml-2 align-middle text-xs font-medium uppercase tracking-wide text-neutral-400">
            {order.channel === "POS" ? "In-store" : "Online"}
          </span>
        </h1>
        <span className="text-sm text-neutral-500">Placed {dateFormatter.format(order.createdAt)}</span>
      </div>

      {order.voidedAt && (
        <p className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          Voided by {order.voidedByName ?? "unknown"} on {dateFormatter.format(order.voidedAt)}
          {order.voidReason && <> — &ldquo;{order.voidReason}&rdquo;</>}
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {order.channel === "POS" ? (
            <section className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h2 className="font-medium text-neutral-900">In-store sale</h2>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <Info label="Cashier" value={order.cashierName ?? "—"} />
                {order.customerName && <Info label="Customer" value={order.customerName} />}
              </dl>
            </section>
          ) : (
            <section className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h2 className="font-medium text-neutral-900">Customer &amp; delivery</h2>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <Info label="Name" value={order.customerName ?? "—"} />
                <Info label="Phone" value={order.phone ?? "—"} />
                <Info label="Email" value={order.email ?? "—"} />
                <Info
                  label="Address"
                  value={`${order.addressLine}, ${order.barangay}, ${order.city}, ${order.province}${order.postalCode ? " " + order.postalCode : ""}`}
                />
                {order.deliveryNotes && <Info label="Delivery notes" value={order.deliveryNotes} />}
              </dl>
            </section>
          )}

          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="font-medium text-neutral-900">Items</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between text-sm">
                  <span className="text-neutral-600">
                    {item.productName} <span className="text-neutral-400">&times;{item.quantity}</span>
                  </span>
                  <span className="font-medium text-neutral-900">{formatCentavosAsPHP(item.subtotalCentavos)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-1.5 border-t border-neutral-100 pt-4 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span>{formatCentavosAsPHP(order.subtotalCentavos)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Delivery fee</span>
                <span>{formatCentavosAsPHP(order.deliveryFeeCentavos)}</span>
              </div>
              {order.discountCentavos > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span>Discount</span>
                  <span>&minus;{formatCentavosAsPHP(order.discountCentavos)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-neutral-100 pt-2 text-base font-semibold text-neutral-900">
                <span>Total</span>
                <span>{formatCentavosAsPHP(order.totalCentavos)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="font-medium text-neutral-900">Payment</h2>
            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Info
                label="Method"
                value={order.paymentMethod ? PAYMENT_METHOD_LABELS[order.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? order.paymentMethod : "—"}
              />
              {order.channel === "ONLINE" && <Info label="Sandbox/demo payment" value={order.isMockPayment ? "Yes" : "No"} />}
              {order.cashReceivedCentavos !== null && (
                <Info label="Cash received" value={formatCentavosAsPHP(order.cashReceivedCentavos)} />
              )}
              {order.changeGivenCentavos !== null && (
                <Info label="Change given" value={formatCentavosAsPHP(order.changeGivenCentavos)} />
              )}
            </dl>
          </section>
        </div>

        <div className="lg:col-span-1">
          <OrderStatusEditor
            orderId={order.id}
            orderStatus={order.orderStatus}
            paymentStatus={order.paymentStatus}
            paymentMethod={order.paymentMethod}
            internalNotes={order.internalNotes ?? ""}
            lastUpdatedByName={order.lastUpdatedByName}
          />
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="mt-0.5 text-neutral-900">{value}</dd>
    </div>
  );
}
