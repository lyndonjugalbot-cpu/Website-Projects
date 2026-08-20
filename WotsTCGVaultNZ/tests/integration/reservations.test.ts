import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { reserveListing, releaseReservation, consumeReservation, sweepExpiredReservations, ReservationError } from "@/lib/reservations";
import { randomUUID } from "crypto";

/**
 * Integration tests run against the real local Postgres (same DB used for
 * `npm run dev` — see docs/DEPLOYMENT.md for the docker command). Every
 * row created here is scoped under a unique run id and torn down in
 * afterAll, so this is safe to run against the same database as seeded
 * demo data without disturbing it.
 */
describe("listing reservations", () => {
  const runId = randomUUID().slice(0, 8);
  let sellerId: string;
  let buyerId: string;
  let listingId: string;

  beforeAll(async () => {
    const seller = await prisma.user.create({
      data: {
        fullName: "Test Seller",
        username: `test-seller-${runId}`,
        email: `seller-${runId}@example.test`,
        role: "SELLER",
        location: "Auckland",
      },
    });
    const buyer = await prisma.user.create({
      data: {
        fullName: "Test Buyer",
        username: `test-buyer-${runId}`,
        email: `buyer-${runId}@example.test`,
        role: "BUYER",
        location: "Auckland",
      },
    });
    const listing = await prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: "Test Card (one-of-one)",
        slug: `test-card-${runId}`,
        category: "SINGLE_CARD",
        priceCents: 1000,
        quantity: 1,
        condition: "NEAR_MINT",
        description: "A test listing used only by the automated test suite.",
        isAuthenticityDeclared: true,
        region: "Auckland",
        status: "ACTIVE",
      },
    });
    sellerId = seller.id;
    buyerId = buyer.id;
    listingId = listing.id;
  });

  afterAll(async () => {
    await prisma.listingReservation.deleteMany({ where: { listingId } });
    await prisma.listing.deleteMany({ where: { id: listingId } });
    await prisma.user.deleteMany({ where: { id: { in: [sellerId, buyerId] } } });
  });

  it("reserves available inventory and increments reservedQuantity", async () => {
    const { reservation } = await reserveListing({ listingId, buyerId, quantity: 1 });
    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.reservedQuantity).toBe(1);

    await releaseReservation(reservation.id);
    const released = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(released.reservedQuantity).toBe(0);
  });

  it("prevents two concurrent buyers from both reserving the last unit of a one-of-one item", async () => {
    // Simulates two checkout requests racing for the same single-quantity
    // listing — this is exactly the scenario the atomic guarded UPDATE in
    // lib/reservations.ts exists to prevent.
    const results = await Promise.allSettled([
      reserveListing({ listingId, buyerId, quantity: 1 }),
      reserveListing({ listingId, buyerId: `${buyerId}-other`, quantity: 1 }),
    ]);

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(ReservationError);

    // Clean up whichever reservation succeeded.
    const active = await prisma.listingReservation.findFirst({ where: { listingId, status: "ACTIVE" } });
    if (active) await releaseReservation(active.id);
  });

  it("consuming a reservation decrements quantity and marks the listing SOLD once it hits zero", async () => {
    const { reservation } = await reserveListing({ listingId, buyerId, quantity: 1 });
    const order = await prisma.order.create({
      data: {
        buyerId,
        status: "PENDING_PAYMENT",
        subtotalCents: 1000,
        shippingCents: 0,
        totalCents: 1000,
        shippingName: "",
        shippingAddress1: "",
        shippingCity: "",
        shippingPostcode: "",
        items: {
          create: [{ listingId, sellerId, titleSnapshot: "Test Card", priceCents: 1000, quantity: 1 }],
        },
      },
    });
    await prisma.listingReservation.update({ where: { id: reservation.id }, data: { orderId: order.id } });

    await consumeReservation(order.id);

    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.quantity).toBe(0);
    expect(listing.status).toBe("SOLD");
    expect(listing.reservedQuantity).toBe(0);

    await prisma.order.delete({ where: { id: order.id } });
    // Restore listing state for subsequent tests in this file.
    await prisma.listing.update({ where: { id: listingId }, data: { quantity: 1, status: "ACTIVE", soldAt: null } });
  });

  it("sweepExpiredReservations releases reservations past their expiry", async () => {
    const { reservation } = await reserveListing({ listingId, buyerId, quantity: 1 });
    // Force it into the past — reserveListing always sets a future expiry.
    await prisma.listingReservation.update({ where: { id: reservation.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const released = await sweepExpiredReservations();
    expect(released).toBeGreaterThanOrEqual(1);

    const updated = await prisma.listingReservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(updated.status).toBe("RELEASED");

    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.reservedQuantity).toBe(0);
  });
});
