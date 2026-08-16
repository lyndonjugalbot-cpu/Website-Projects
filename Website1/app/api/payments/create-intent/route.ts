import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { attachPaymentIntentToOrder, getOrderById, markOrderFailed, markOrderPaid } from "@/lib/orders";
import { attachPaymentMethod, createPaymentIntent, createPaymentMethod } from "@/lib/paymongo";

const bodySchema = z.object({
  orderId: z.string().min(1),
  method: z.enum(["gcash", "paymaya", "card"]),
  card: z
    .object({
      cardNumber: z.string().min(12).max(19),
      expMonth: z.number().int().min(1).max(12),
      expYear: z.number().int().min(2024).max(2100),
      cvc: z.string().min(3).max(4),
    })
    .optional(),
});

/**
 * Kicks off (or resumes) payment for an order: creates a Payment Intent if
 * needed, creates a Payment Method from the chosen option, and attaches it.
 * Returns where the client should go next — a redirect (GCash/Maya/3DS/mock
 * gateway) or straight to the order-return page to see the outcome.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payment request" }, { status: 400 });
  }
  const { orderId, method, card } = parsed.data;

  if (method === "card" && !card) {
    return NextResponse.json({ error: "Card details are required" }, { status: 400 });
  }

  const order = await getOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "PAID") {
    return NextResponse.json({ status: "succeeded", redirectUrl: null, isMock: order.isMockPayment });
  }

  const appUrl = request.nextUrl.origin;
  const returnUrl = `${appUrl}/checkout/${orderId}/return`;

  try {
    let intentId = order.paymentIntentId;
    let isMock = order.isMockPayment;

    if (!intentId) {
      const intent = await createPaymentIntent({
        amountCentavos: order.totalCentavos,
        description: `Order ${order.id.slice(0, 8)}`,
        metadata: { orderId: order.id },
      });
      intentId = intent.id;
      isMock = intent.isMock;
      await attachPaymentIntentToOrder(orderId, {
        paymentIntentId: intentId,
        paymentMethod: method,
        isMockPayment: isMock,
      });
    }

    const paymentMethod = await createPaymentMethod({
      type: method,
      billing: { name: order.customerName, email: order.email, phone: order.phone },
      card,
    });

    const attachResult = await attachPaymentMethod({
      intentId,
      paymentMethodId: paymentMethod.id,
      returnUrl,
      isMock: isMock || paymentMethod.isMock,
    });

    if (isMock || paymentMethod.isMock) {
      return NextResponse.json({
        status: "redirect",
        redirectUrl: `${appUrl}/checkout/${orderId}/mock-gateway`,
        isMock: true,
      });
    }

    if (attachResult.nextActionRedirectUrl) {
      return NextResponse.json({
        status: "redirect",
        redirectUrl: attachResult.nextActionRedirectUrl,
        isMock: false,
      });
    }

    if (attachResult.status === "succeeded") {
      await markOrderPaid(orderId);
      return NextResponse.json({ status: "succeeded", redirectUrl: returnUrl, isMock: false });
    }

    if (attachResult.status === "processing") {
      return NextResponse.json({ status: "processing", redirectUrl: returnUrl, isMock: false });
    }

    await markOrderFailed(orderId);
    return NextResponse.json({
      status: "failed",
      redirectUrl: returnUrl,
      isMock: false,
      error: attachResult.lastPaymentError,
    });
  } catch (err) {
    console.error("Payment attempt failed", err);
    const message = err instanceof Error ? err.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
