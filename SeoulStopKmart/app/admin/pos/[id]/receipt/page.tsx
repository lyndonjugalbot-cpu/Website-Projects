import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCentavosAsPHP } from "@/lib/money";
import { formatManilaDateTime } from "@/lib/timezone";
import { PAYMENT_METHOD_LABELS } from "@/lib/types";
import { STORE_NAME } from "@/lib/store-config";
import { ReceiptActions } from "@/components/admin/pos/ReceiptActions";
import { RefundPanel } from "@/components/admin/pos/RefundPanel";
import { canRefund } from "@/lib/pos";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: true, refunds: { orderBy: { createdAt: "asc" } } },
  });
  if (!order || order.channel !== "POS") notFound();

  // Voids and refunds are manager/owner only (lib/pos.ts). A void would put
  // everything back in stock, so once part of a sale is refunded only Refund remains.
  const isAdmin = canRefund(session.user.role);
  const canVoid = isAdmin && !order.voidedAt && order.refundedCentavos === 0;
  const canRefundItems = isAdmin && !order.voidedAt && order.paymentStatus === "PAID";

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
      {!order.voidedAt && order.refundedCentavos > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800 print:hidden">
          {order.paymentStatus === "REFUNDED" ? "Fully refunded" : "Partly refunded"} —{" "}
          {formatCentavosAsPHP(order.refundedCentavos)} paid back
        </p>
      )}

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-6 font-mono text-sm print:border-none print:p-0">
        <div className="text-center">
          <p className="text-base font-semibold">{STORE_NAME}</p>
          <p className="mt-2 text-xs text-neutral-500">{formatManilaDateTime(order.createdAt)}</p>
          <p className="text-xs text-neutral-500">Receipt #{order.id.slice(0, 10).toUpperCase()}</p>
          <p className="text-xs text-neutral-500">Cashier: {order.cashierName}</p>
        </div>

        <div className="mt-4 border-t border-dashed border-neutral-300 pt-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-0.5">
              <span>
                {item.productName} x{item.quantity}
                {item.refundedQuantity > 0 && <span className="text-neutral-400"> ({item.refundedQuantity} refunded)</span>}
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
          {order.discountCentavos - order.pointsDiscountCentavos > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-{formatCentavosAsPHP(order.discountCentavos - order.pointsDiscountCentavos)}</span>
            </div>
          )}
          {order.pointsDiscountCentavos > 0 && (
            <div className="flex justify-between">
              <span>Points used ({order.pointsRedeemed})</span>
              <span>-{formatCentavosAsPHP(order.pointsDiscountCentavos)}</span>
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
          {order.gcashAmountCentavos !== null && (
            <>
              <div className="flex justify-between">
                <span>GCash</span>
                <span>{formatCentavosAsPHP(order.gcashAmountCentavos)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash</span>
                <span>{formatCentavosAsPHP(order.totalCentavos - order.gcashAmountCentavos)}</span>
              </div>
            </>
          )}
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

        {order.customerId && (
          <div className="mt-3 flex flex-col gap-0.5 border-t border-dashed border-neutral-300 pt-3">
            <div className="flex justify-between">
              <span>Rewards member</span>
              <span>{order.customerName}</span>
            </div>
            {order.pointsEarned > 0 && (
              <div className="flex justify-between">
                <span>Points earned</span>
                <span>+{order.pointsEarned}</span>
              </div>
            )}
            {order.pointsRedeemed > 0 && (
              <div className="flex justify-between">
                <span>Points used</span>
                <span>-{order.pointsRedeemed}</span>
              </div>
            )}
            {order.pointsBalanceAfter !== null && (
              <div className="flex justify-between font-semibold">
                <span>Points balance</span>
                <span>{order.pointsBalanceAfter}</span>
              </div>
            )}
          </div>
        )}

        {order.refunds.length > 0 && (
          <div className="mt-3 flex flex-col gap-1 border-t border-dashed border-neutral-300 pt-3">
            {order.refunds.map((r) => {
              const lines = r.items as { productName: string; quantity: number }[];
              return (
                <div key={r.id}>
                  <div className="flex justify-between font-semibold">
                    <span>REFUND ({r.method === "gcash" ? "GCash" : "Cash"})</span>
                    <span>-{formatCentavosAsPHP(r.amountCentavos)}</span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    {lines.map((l) => `${l.productName} x${l.quantity}`).join(", ")}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {formatManilaDateTime(r.createdAt)} · {r.refundedByName} · {r.reason}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-neutral-400">Thank you for shopping with us!</p>
      </div>

      <div className="mt-5">
        <ReceiptActions orderId={order.id} canVoid={canVoid} />
      </div>

      {canRefundItems && (
        <RefundPanel
          orderId={order.id}
          subtotalCentavos={order.subtotalCentavos}
          totalCentavos={order.totalCentavos}
          refundedCentavos={order.refundedCentavos}
          defaultMethod={order.paymentMethod === "gcash" ? "gcash" : "cash"}
          items={order.items.map((i) => ({
            id: i.id,
            productName: i.productName,
            unitPriceCentavos: i.unitPriceCentavos,
            quantity: i.quantity,
            refundedQuantity: i.refundedQuantity,
          }))}
        />
      )}
    </div>
  );
}
