import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";

/**
 * Idempotency gate for Stripe webhooks. `WebhookEvent.id` is the Stripe
 * event id itself, so a duplicate delivery hits a unique-constraint
 * violation on insert — `alreadyProcessed` returns true and the caller
 * skips all business logic instead of double-applying it (double-crediting
 * a payout, double-decrementing stock, etc).
 */
export async function claimWebhookEvent(event: Stripe.Event): Promise<{ alreadyProcessed: boolean }> {
  try {
    await prisma.webhookEvent.create({
      data: {
        id: event.id,
        type: event.type,
        status: "RECEIVED",
        payload: event as unknown as object,
      },
    });
    return { alreadyProcessed: false };
  } catch (err) {
    // P2002 = unique constraint violation -> we've seen this event id before.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      await prisma.webhookEvent
        .update({ where: { id: event.id }, data: { attempts: { increment: 1 } } })
        .catch(() => null);
      return { alreadyProcessed: true };
    }
    throw err;
  }
}

export async function markWebhookEventProcessed(eventId: string) {
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: { status: "PROCESSED", processedAt: new Date() },
  });
}

export async function markWebhookEventFailed(eventId: string, error: string) {
  await prisma.webhookEvent
    .update({ where: { id: eventId }, data: { status: "FAILED", error: error.slice(0, 2000) } })
    .catch(() => null);
}
