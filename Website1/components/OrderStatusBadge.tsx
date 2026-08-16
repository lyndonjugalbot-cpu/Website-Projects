import type { OrderStatus, PaymentStatus } from "@/lib/types";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/types";

const ORDER_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-sky-100 text-sky-700",
  PREPARING: "bg-indigo-100 text-indigo-700",
  READY_FOR_DELIVERY: "bg-violet-100 text-violet-700",
  OUT_FOR_DELIVERY: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-neutral-200 text-neutral-500",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${ORDER_STYLES[status]}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PROCESSING: "bg-sky-100 text-sky-700",
  PAID: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  REFUNDED: "bg-neutral-200 text-neutral-500",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${PAYMENT_STYLES[status]}`}>
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
