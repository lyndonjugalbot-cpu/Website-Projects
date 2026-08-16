import { NextRequest, NextResponse } from "next/server";
import { getOrderByPaymentIntentId, markOrderFailed, markOrderPaid } from "@/lib/orders";
import { verifyWebhookSignature } from "@/lib/paymongo";

/**
 * Receives payment confirmation events from PayMongo. Register this URL
 * (https://<your-domain>/api/webhooks/paymongo) in the PayMongo Dashboard
 * under Developers > Webhooks, subscribed to at least `payment.paid` and
 * `payment.failed`. See README for local testing without a public URL.
 */
export async function POST(request: NextRequest) {
  // Read the raw body — signature verification needs the exact bytes PayMongo
  // signed, so this must happen before any JSON parsing.
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("paymongo-signature");
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

  if (webhookSecret) {
    if (!signatureHeader || !verifyWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
      console.warn("Rejected PayMongo webhook with invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    console.warn(
      "PAYMONGO_WEBHOOK_SECRET is not set — skipping signature verification. Do not run production like this."
    );
  }

  type PaymongoWebhookEvent = {
    data?: {
      attributes?: {
        type?: string;
        data?: { id?: string; type?: string; attributes?: { payment_intent_id?: string } };
      };
    };
  };

  let event: PaymongoWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaymongoWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType: string | undefined = event?.data?.attributes?.type;
  const resource = event?.data?.attributes?.data;
  const paymentIntentId: string | undefined =
    resource?.attributes?.payment_intent_id ?? (resource?.type === "payment_intent" ? resource?.id : undefined);

  if (!eventType || !paymentIntentId) {
    console.warn("Ignoring PayMongo webhook with unrecognized shape", { eventType, paymentIntentId });
    return NextResponse.json({ received: true });
  }

  const order = await getOrderByPaymentIntentId(paymentIntentId);
  if (!order) {
    console.warn(`No order found for PayMongo payment_intent_id ${paymentIntentId}`);
    return NextResponse.json({ received: true });
  }

  switch (eventType) {
    case "payment.paid":
    case "payment_intent.succeeded":
      await markOrderPaid(order.id);
      break;
    case "payment.failed":
    case "payment_intent.payment_failed":
      await markOrderFailed(order.id);
      break;
    default:
      // Other event types (refunds, etc.) aren't handled in this demo.
      break;
  }

  return NextResponse.json({ received: true });
}
