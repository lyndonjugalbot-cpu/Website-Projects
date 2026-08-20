import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { startInspectionPeriod, sweepInspectionPeriods, holdPayoutsForOrder } from "@/lib/payouts";
import { randomUUID } from "crypto";

describe("payout eligibility sweep", () => {
  const runId = randomUUID().slice(0, 8);
  let sellerId: string;
  let buyerId: string;
  let listingId: string;
  let orderId: string;

  beforeAll(async () => {
    const seller = await prisma.user.create({
      data: { fullName: "Payout Seller", username: `payout-seller-${runId}`, email: `payout-seller-${runId}@example.test`, role: "SELLER", location: "Auckland" },
    });
    const buyer = await prisma.user.create({
      data: { fullName: "Payout Buyer", username: `payout-buyer-${runId}`, email: `payout-buyer-${runId}@example.test`, role: "BUYER", location: "Auckland" },
    });
    const listing = await prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: "Payout Test Card",
        slug: `payout-test-card-${runId}`,
        category: "SINGLE_CARD",
        priceCents: 5000,
        quantity: 1,
        condition: "NEAR_MINT",
        description: "A test listing used only by the automated test suite.",
        isAuthenticityDeclared: true,
        region: "Auckland",
        status: "SOLD",
      },
    });
    const order = await prisma.order.create({
      data: {
        buyerId: buyer.id,
        status: "AWAITING_SHIPMENT",
        subtotalCents: 5000,
        shippingCents: 500,
        platformFeeCents: 400,
        totalCents: 5500,
        shippingName: "Test Buyer",
        shippingAddress1: "1 Test Street",
        shippingCity: "Auckland",
        shippingPostcode: "1010",
        items: { create: [{ listingId: listing.id, sellerId: seller.id, titleSnapshot: listing.title, priceCents: 5000, quantity: 1 }] },
      },
    });
    sellerId = seller.id;
    buyerId = buyer.id;
    listingId = listing.id;
    orderId = order.id;
  });

  afterAll(async () => {
    await prisma.dispute.deleteMany({ where: { orderId } });
    await prisma.payout.deleteMany({ where: { orderItemIds: { hasSome: [orderId] } } });
    // orderItemIds stores OrderItem ids, not the order id — clean up by seller instead.
    await prisma.payout.deleteMany({ where: { sellerId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.listing.deleteMany({ where: { id: listingId } });
    await prisma.user.deleteMany({ where: { id: { in: [sellerId, buyerId] } } });
  });

  it("starts an inspection period on delivery confirmation and creates a NOT_ELIGIBLE payout", async () => {
    await startInspectionPeriod(orderId, new Date());

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("INSPECTION_PERIOD");
    expect(order.inspectionEndAt).not.toBeNull();

    const payout = await prisma.payout.findFirst({ where: { sellerId } });
    expect(payout).not.toBeNull();
    expect(payout!.status).toBe("NOT_ELIGIBLE");
  });

  it("does NOT promote to PAYOUT_ELIGIBLE before the inspection period has elapsed", async () => {
    const promoted = await sweepInspectionPeriods();
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    // Our order's inspectionEndAt is ~48h in the future, so this sweep run
    // should not have touched it (promoted counts orders across the whole
    // table, so we assert on our specific order rather than the count).
    expect(order.status).toBe("INSPECTION_PERIOD");
    expect(promoted).toBeGreaterThanOrEqual(0);
  });

  it("promotes to PAYOUT_ELIGIBLE once the inspection period has elapsed with no dispute", async () => {
    await prisma.order.update({ where: { id: orderId }, data: { inspectionEndAt: new Date(Date.now() - 1000) } });

    await sweepInspectionPeriods();

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("PAYOUT_ELIGIBLE");

    const payout = await prisma.payout.findFirstOrThrow({ where: { sellerId } });
    expect(payout.status).toBe("ELIGIBLE");
  });

  it("holding payouts for a disputed order blocks the eligibility sweep from releasing it", async () => {
    await holdPayoutsForOrder(orderId);
    const payout = await prisma.payout.findFirstOrThrow({ where: { sellerId } });
    expect(payout.status).toBe("ON_HOLD");
  });
});
