import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { executeTool } from "@/lib/ai/tools";
import { randomUUID } from "crypto";

/**
 * Security-relevant behavior under test: executeTool's account-scoped tools
 * take `userId` only from the caller (the route handler's own session),
 * never from model-supplied input, so one user can never see another's
 * orders/listings through the chatbot even if both exist in the same table.
 */
describe("AI chat tools — account scoping", () => {
  const runId = randomUUID().slice(0, 8);
  let sellerAId: string;
  let sellerBId: string;
  let buyerAId: string;
  let listingAId: string;
  let listingBId: string;
  let orderAId: string;
  let orderBId: string;

  beforeAll(async () => {
    const [sellerA, sellerB, buyerA] = await Promise.all([
      prisma.user.create({
        data: { fullName: "Chat Seller A", username: `chat-seller-a-${runId}`, email: `chat-seller-a-${runId}@example.test`, role: "SELLER", location: "Auckland" },
      }),
      prisma.user.create({
        data: { fullName: "Chat Seller B", username: `chat-seller-b-${runId}`, email: `chat-seller-b-${runId}@example.test`, role: "SELLER", location: "Wellington" },
      }),
      prisma.user.create({
        data: { fullName: "Chat Buyer A", username: `chat-buyer-a-${runId}`, email: `chat-buyer-a-${runId}@example.test`, role: "BUYER", location: "Auckland" },
      }),
    ]);
    sellerAId = sellerA.id;
    sellerBId = sellerB.id;
    buyerAId = buyerA.id;

    const [listingA, listingB] = await Promise.all([
      prisma.listing.create({
        data: {
          sellerId: sellerAId,
          title: "Seller A's Card",
          slug: `chat-listing-a-${runId}`,
          category: "SINGLE_CARD",
          priceCents: 2000,
          quantity: 1,
          description: "Automated test listing.",
          isAuthenticityDeclared: true,
          region: "Auckland",
          status: "ACTIVE",
        },
      }),
      prisma.listing.create({
        data: {
          sellerId: sellerBId,
          title: "Seller B's Card",
          slug: `chat-listing-b-${runId}`,
          category: "SINGLE_CARD",
          priceCents: 3000,
          quantity: 1,
          description: "Automated test listing.",
          isAuthenticityDeclared: true,
          region: "Wellington",
          status: "ACTIVE",
        },
      }),
    ]);
    listingAId = listingA.id;
    listingBId = listingB.id;

    const orderA = await prisma.order.create({
      data: {
        buyerId: buyerAId,
        status: "PAID",
        subtotalCents: 2000,
        shippingCents: 0,
        totalCents: 2000,
        shippingName: "Chat Buyer A",
        shippingAddress1: "1 Test Street",
        shippingCity: "Auckland",
        shippingPostcode: "1010",
        items: { create: [{ listingId: listingAId, sellerId: sellerAId, titleSnapshot: listingA.title, priceCents: 2000, quantity: 1 }] },
      },
    });
    const orderB = await prisma.order.create({
      data: {
        buyerId: buyerAId,
        status: "PAID",
        subtotalCents: 3000,
        shippingCents: 0,
        totalCents: 3000,
        shippingName: "Chat Buyer A",
        shippingAddress1: "1 Test Street",
        shippingCity: "Auckland",
        shippingPostcode: "1010",
        items: { create: [{ listingId: listingBId, sellerId: sellerBId, titleSnapshot: listingB.title, priceCents: 3000, quantity: 1 }] },
      },
    });
    orderAId = orderA.id;
    orderBId = orderB.id;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { id: { in: [orderAId, orderBId] } } });
    await prisma.listing.deleteMany({ where: { id: { in: [listingAId, listingBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [sellerAId, sellerBId, buyerAId] } } });
  });

  it("get_my_listings only returns the calling seller's own listings", async () => {
    const result = (await executeTool("get_my_listings", {}, sellerAId)) as { title: string }[];
    expect(result.some((l) => l.title === "Seller A's Card")).toBe(true);
    expect(result.some((l) => l.title === "Seller B's Card")).toBe(false);
  });

  it("get_my_orders as seller only returns orders containing that seller's own items", async () => {
    const result = (await executeTool("get_my_orders", { role: "seller" }, sellerAId)) as { id: string }[];
    expect(result.some((o) => o.id === orderAId)).toBe(true);
    expect(result.some((o) => o.id === orderBId)).toBe(false);
  });

  it("get_my_orders as buyer returns both of the buyer's orders regardless of seller", async () => {
    const result = (await executeTool("get_my_orders", { role: "buyer" }, buyerAId)) as { id: string }[];
    expect(result.some((o) => o.id === orderAId)).toBe(true);
    expect(result.some((o) => o.id === orderBId)).toBe(true);
  });

  it("ignores unknown/malformed input rather than throwing", async () => {
    const result = await executeTool("get_my_orders", { role: "not-a-real-role" }, buyerAId);
    expect(Array.isArray(result)).toBe(true);
  });
});
