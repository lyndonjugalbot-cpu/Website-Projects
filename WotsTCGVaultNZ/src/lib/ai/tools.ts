import type OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { formatNZD, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import type { ListingStatus } from "@prisma/client";

const LISTING_STATUSES: ListingStatus[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "ACTIVE",
  "PAUSED",
  "SOLD",
  "REMOVED",
  "REJECTED",
];

/**
 * Read-only, account-scoped tools the chatbot can call. `userId` always
 * comes from the caller's own session in the route handler — it is never
 * taken from the model's tool `input`, so the model has no way to request
 * another user's data.
 */
export const AI_TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_my_orders",
      description:
        "Look up the signed-in user's own recent orders, either as buyer or as seller. Returns at most the 10 most recent, scoped only to this user.",
      parameters: {
        type: "object",
        properties: {
          role: {
            type: "string",
            enum: ["buyer", "seller"],
            description: "Whether to look up orders where this user was the buyer or the seller.",
          },
        },
        required: ["role"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_listings",
      description:
        "Look up the signed-in user's own listings. Returns at most the 10 most recent, scoped only to this user.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: LISTING_STATUSES,
            description: "Optional filter by listing status.",
          },
        },
      },
    },
  },
];

export async function executeTool(name: string, input: unknown, userId: string): Promise<unknown> {
  const args = (input ?? {}) as Record<string, unknown>;

  if (name === "get_my_orders") {
    const role = args.role === "seller" ? "seller" : "buyer";

    const orders =
      role === "buyer"
        ? await prisma.order.findMany({
            where: { buyerId: userId },
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { items: { select: { titleSnapshot: true, quantity: true } } },
          })
        : await prisma.order.findMany({
            where: { items: { some: { sellerId: userId } } },
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { items: { where: { sellerId: userId }, select: { titleSnapshot: true, quantity: true } } },
          });

    return orders.map((order) => ({
      id: order.id,
      status: ORDER_STATUS_LABELS[order.status],
      total: formatNZD(order.totalCents),
      items: order.items.map((item) => `${item.titleSnapshot} x${item.quantity}`),
      createdAt: formatDate(order.createdAt),
    }));
  }

  if (name === "get_my_listings") {
    const status =
      typeof args.status === "string" && LISTING_STATUSES.includes(args.status as ListingStatus)
        ? (args.status as ListingStatus)
        : undefined;

    const listings = await prisma.listing.findMany({
      where: { sellerId: userId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { title: true, slug: true, status: true, priceCents: true, quantity: true, createdAt: true },
    });

    return listings.map((listing) => ({
      title: listing.title,
      status: listing.status,
      price: formatNZD(listing.priceCents),
      quantity: listing.quantity,
      url: `/listing/${listing.slug}`,
      createdAt: formatDate(listing.createdAt),
    }));
  }

  return { error: `Unknown tool: ${name}` };
}
