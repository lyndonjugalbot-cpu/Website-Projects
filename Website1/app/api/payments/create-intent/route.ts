import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  attachOfflinePaymentMethod,
  attachPaymentIntentToOrder,
  getOrderById,
  markOrderPaymentFailed,
  markOrderPaid,
} from "@/lib/orders";
import { attachPaymentMethod, createPaymentIntent, createPaymentMethod } from "@/lib/paymongo";

const bodySchema = z.object({
  orderId: z.string().min(1),
  method: z.enum(["gcash", "paymaya", "card", "cod", "bank_transfer"]),
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
  if (order.channel !== "ONLINE" || !order.customerName || !order.email || !order.phone) {
    // POS sales are completed directly by lib/pos.ts and never reach this
    // gateway-payment route; this is just a defensive guard.
    return NextResponse.json({ error: "This order can't be paid through the online gateway" }, { status: 400 });
  }
  if (order.paymentStatus === "PAID") {
    return NextResponse.json({ status: "succeeded", redirectUrl: null, isMock: order.isMockPayment });
  }

  const appUrl = request.nextUrl.origin;
  const returnUrl = `${appUrl}/checkout/${orderId}/return`;

  // COD and bank transfer never touch PayMongo — no gateway, no card/GCash
  // redirect. paymentStatus stays PENDING; staff confirm funds were
  // actually received from the admin order screen before it's marked PAID.
  // Routed to a dedicated confirmation page (not the payment-return poller)
  // since there's no gateway event to wait for.
  if (method === "cod" || method === "bank_transfer") {
    await attachOfflinePaymentMethod(orderId, method);
    return NextResponse.json({
      status: "confirmed",
      redirectUrl: `${appUrl}/checkout/${orderId}/order-placed`,
      isMock: false,
    });
  }

  try {
    let intentId = order.paymentIntentId;
    let isMock = order.isMockPayment;

    // First payment attempt for this order — create the Payment Intent.
    // Reused on retry (e.g. after a declined card) instead of creating a
    // second one.
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

    // No real PayMongo keys configured — send the customer to our own fake
    // gateway screen instead of a real one.
    if (isMock || paymentMethod.isMock) {
      return NextResponse.json({
        status: "redirect",
        redirectUrl: `${appUrl}/checkout/${orderId}/mock-gateway`,
        isMock: true,
      });
    }

    // Real PayMongo GCash/Maya/3DS card payments need the customer to
    // authorize on a page PayMongo hosts — send them there.
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

    await markOrderPaymentFailed(orderId);
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
