import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCentavosAsPHP } from "@/lib/money";
import { formatManilaDateTime } from "@/lib/timezone";
import { PAYMENT_METHOD_LABELS } from "@/lib/types";
import { STORE_NAME, CONTACT_PHONE } from "@/lib/store-config";
import { ReceiptActions } from "@/components/admin/pos/ReceiptActions";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const order = await prisma.order.findUnique({ where: { id: params.id }, include: { items: true } });
  if (!order || order.channel !== "POS") notFound();

  const isOwnRecentSale =
    order.cashierId === session.user.id && Date.now() - order.createdAt.getTime() <= 10 * 60_000;
  const canVoid =
    !order.voidedAt && (session.user.role === "OWNER" || session.user.role === "MANAGER" || isOwnRecentSale);

  return (
    <div className="mx-auto max-w-md">
      <Link href="/admin/pos" className="text-sm text-neutral-500 hover:text-neutral-800 print:hidden">
        &larr; Back to POS
      </Link>

      {order.voidedAt && (
        <p className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 print:hidden">
          This sale was voided by {order.voidedByName} — {order.voidReason}
        </p>
      )}

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-6 font-mono text-sm print:border-none print:p-0">
        <div className="text-center">
          <p className="text-base font-semibold">{STORE_NAME}</p>
          <p className="text-xs text-neutral-500">{CONTACT_PHONE}</p>
          <p className="mt-2 text-xs text-neutral-500">{formatManilaDateTime(order.createdAt)}</p>
          <p className="text-xs text-neutral-500">Receipt #{order.id.slice(0, 10).toUpperCase()}</p>
          <p className="text-xs text-neutral-500">Cashier: {order.cashierName}</p>
        </div>

        <div className="mt-4 border-t border-dashed border-neutral-300 pt-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-0.5">
              <span>
                {item.productName} x{item.quantity}
              </span>
              <span>{formatCentavosAsPHP(item.subtotalCentavos)}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-0.5 border-t border-dashed border-neutral-300 pt-3">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCentavosAsPHP(order.subtotalCentavos)}</span>
          </div>
          {order.discountCentavos > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-{formatCentavosAsPHP(order.discountCentavos)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <span>TOTAL</span>
            <span>{formatCentavosAsPHP(order.totalCentavos)}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-0.5 border-t border-dashed border-neutral-300 pt-3">
          <div className="flex justify-between">
            <span>Payment</span>
            <span>{PAYMENT_METHOD_LABELS[order.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? order.paymentMethod}</span>
          </div>
          {order.cashReceivedCentavos !== null && (
            <div className="flex justify-between">
              <span>Cash received</span>
              <span>{formatCentavosAsPHP(order.cashReceivedCentavos)}</span>
            </div>
          )}
          {order.changeGivenCentavos !== null && (
            <div className="flex justify-between">
              <span>Change</span>
              <span>{formatCentavosAsPHP(order.changeGivenCentavos)}</span>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400">Thank you for shopping with us!</p>
      </div>

      <div className="mt-5">
        <ReceiptActions orderId={order.id} canVoid={canVoid} />
      </div>
    </div>
  );
}
