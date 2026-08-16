import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/orders";
import { formatCentavosAsPHP } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { orderId?: string };
}) {
  if (!searchParams.orderId) notFound();
  const order = await getOrderById(searchParams.orderId);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-7 w-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-900">Payment successful</h1>
      <p className="mt-2 text-neutral-500">
        Thanks, {order.customerName.split(" ")[0]}! Your order has been placed.
      </p>

      <div className="mt-8 rounded-2xl border border-neutral-200 p-6 text-left">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-500">Order ID</span>
          <span className="font-mono text-neutral-900">{order.id}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-neutral-500">Paid with</span>
          <span className="text-neutral-900">
            {order.paymentMethod?.toUpperCase()} {order.isMockPayment && "(mock)"}
          </span>
        </div>
        <ul className="mt-4 flex flex-col gap-2 border-t border-neutral-100 pt-4">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span className="text-neutral-600">
                {item.productName} &times;{item.quantity}
              </span>
              <span className="text-neutral-900">{formatCentavosAsPHP(item.subtotalCentavos)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-neutral-100 pt-4 text-base">
          <span className="font-medium text-neutral-900">Total paid</span>
          <span className="font-semibold text-neutral-900">{formatCentavosAsPHP(order.totalCentavos)}</span>
        </div>
        <p className="mt-4 text-sm text-neutral-500">Delivering to: {order.address}</p>
      </div>

      <Link
        href="/products"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        Continue shopping
      </Link>
    </div>
  );
}
