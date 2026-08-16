import { NextRequest, NextResponse } from "next/server";
import { getOrderById, markOrderFailed, markOrderPaid } from "@/lib/orders";
import { retrievePaymentIntentStatus } from "@/lib/paymongo";

/**
 * Returns order status. For real (non-mock) payments this also proactively
 * checks PayMongo's Payment Intent status as a fallback in case the webhook
 * hasn't arrived yet (e.g. no public URL configured during local dev) — see
 * README for how to test with a real webhook via the PayMongo CLI/ngrok.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const order = await getOrderById(params.id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "PENDING" && order.paymentIntentId && !order.isMockPayment) {
    try {
      const status = await retrievePaymentIntentStatus(order.paymentIntentId);
      if (status === "succeeded") {
        await markOrderPaid(order.id);
      } else if (status === "awaiting_payment_method" && order.updatedAt < new Date(Date.now() - 5 * 60_000)) {
        // Stale intent that never got a payment method attached successfully.
        await markOrderFailed(order.id);
      }
    } catch (err) {
      console.error("Failed to poll PayMongo payment intent status", err);
    }
  }

  const fresh = await getOrderById(params.id);
  return NextResponse.json({
    id: fresh!.id,
    status: fresh!.status,
    totalCentavos: fresh!.totalCentavos,
    customerName: fresh!.customerName,
    email: fresh!.email,
    phone: fresh!.phone,
    address: fresh!.address,
    paymentMethod: fresh!.paymentMethod,
    isMockPayment: fresh!.isMockPayment,
    items: fresh!.items.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      unitPriceCentavos: i.unitPriceCentavos,
      subtotalCentavos: i.subtotalCentavos,
    })),
  });
}
