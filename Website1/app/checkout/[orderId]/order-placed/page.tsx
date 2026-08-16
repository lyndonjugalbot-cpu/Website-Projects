import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/orders";
import { formatCentavosAsPHP } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/types";
import { BANK_TRANSFER_DETAILS } from "@/lib/store-config";

export const dynamic = "force-dynamic";

/**
 * Confirmation page for orders paid via COD or bank transfer — methods that
 * never touch a payment gateway. Deliberately does NOT say "payment
 * successful": paymentStatus stays PENDING until a staff member manually
 * verifies funds were received (see /admin/orders).
 */
export default async function OrderPlacedPage({ params }: { params: { orderId: string } }) {
  const order = await getOrderById(params.orderId);
  if (!order) notFound();

  const isBankTransfer = order.paymentMethod === "bank_transfer";

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-gold/20 text-brand-gold-dark">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-7 w-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-900">Order placed!</h1>
      <p className="mt-2 text-neutral-500">
        Thanks, {order.customerName.split(" ")[0]}! We&apos;ve received your order and our team will confirm it
        shortly.
      </p>

      <div className="mt-8 rounded-2xl border border-neutral-200 p-6 text-left">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-500">Order ID</span>
          <span className="font-mono text-neutral-900">{order.id}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-neutral-500">Payment method</span>
          <span className="text-neutral-900">
            {order.paymentMethod ? PAYMENT_METHOD_LABELS[order.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] : "—"}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-neutral-500">Payment status</span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
            {isBankTransfer ? "Pending verification" : "Pay on delivery"}
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
          <span className="font-medium text-neutral-900">Total due</span>
          <span className="font-semibold text-neutral-900">{formatCentavosAsPHP(order.totalCentavos)}</span>
        </div>
        <p className="mt-4 text-sm text-neutral-500">
          Delivering to: {order.addressLine}, {order.barangay}, {order.city}, {order.province}
        </p>
      </div>

      {isBankTransfer && (
        <div className="mt-6 rounded-2xl bg-brand-red/5 p-6 text-left">
          <p className="text-sm font-medium text-neutral-900">Bank transfer details</p>
          <dl className="mt-3 flex flex-col gap-1.5 text-sm text-neutral-600">
            <div className="flex justify-between">
              <dt>Bank</dt>
              <dd>{BANK_TRANSFER_DETAILS.bankName}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Account name</dt>
              <dd>{BANK_TRANSFER_DETAILS.accountName}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Account number</dt>
              <dd>{BANK_TRANSFER_DETAILS.accountNumber}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-neutral-500">
            Please send the exact total above and keep your receipt — our team will verify your payment and confirm
            your order. This can take a few hours during business hours.
          </p>
        </div>
      )}

      <Link
        href="/products"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-brand-red px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-red-dark"
      >
        Continue shopping
      </Link>
    </div>
  );
}
