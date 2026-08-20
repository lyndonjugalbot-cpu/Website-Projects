import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { claimWebhookEvent, markWebhookEventProcessed } from "@/lib/webhook-events";
import { randomUUID } from "crypto";
import type Stripe from "stripe";

function fakeEvent(id: string): Stripe.Event {
  return {
    id,
    type: "checkout.session.completed",
    object: "event",
    api_version: "2025-02-24.acacia",
    created: Math.floor(Date.now() / 1000),
    data: { object: {} as never },
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
  } as unknown as Stripe.Event;
}

describe("Stripe webhook idempotency", () => {
  const eventId = `evt_test_${randomUUID().slice(0, 12)}`;

  afterAll(async () => {
    await prisma.webhookEvent.deleteMany({ where: { id: eventId } });
  });

  it("claims a new event id on first delivery", async () => {
    const result = await claimWebhookEvent(fakeEvent(eventId));
    expect(result.alreadyProcessed).toBe(false);

    const stored = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
    expect(stored).not.toBeNull();
    expect(stored!.status).toBe("RECEIVED");
  });

  it("rejects a duplicate delivery of the same event id as already-processed", async () => {
    // Same event id delivered again (Stripe explicitly documents this can
    // happen and handlers must tolerate it).
    const result = await claimWebhookEvent(fakeEvent(eventId));
    expect(result.alreadyProcessed).toBe(true);

    const stored = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(stored.attempts).toBe(2);
  });

  it("marks an event PROCESSED only when the handler explicitly does so", async () => {
    let stored = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(stored.status).not.toBe("PROCESSED");

    await markWebhookEventProcessed(eventId);
    stored = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(stored.status).toBe("PROCESSED");
    expect(stored.processedAt).not.toBeNull();
  });
});
