// Business logic for the in-store POS (/admin/pos) — ringing up a sale and
// voiding one. Called from app/api/admin/pos/route.ts and
// app/api/admin/pos/[id]/void/route.ts, which handle auth/HTTP concerns
// and delegate the actual work here.
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { effectivePrice } from "@/lib/types";
import { InsufficientStockError, recordStockMovement } from "@/lib/inventory";

export class PosSaleError extends Error {}

// Validates the request body for POST /api/admin/pos (a completed sale
// from the POS terminal).
export const posSaleInputSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(999),
      })
    )
    .min(1, "Add at least one item"),
  discountCentavos: z.number().int().min(0).default(0),
  paymentMethod: z.enum(["cash", "gcash", "paymaya", "bank_transfer"]),
  cashReceivedCentavos: z.number().int().min(0).optional(),
  customerName: z.string().trim().max(200).optional().or(z.literal("")),
});

export type PosSaleInput = z.infer<typeof posSaleInputSchema>;

/**
 * Rings up an in-store sale: re-prices every line server-side, atomically
 * deducts stock (shared with the online storefront via lib/inventory.ts —
 * same race protection applies), and records the Order as COMPLETED/PAID
 * immediately. Unlike online payments, a POS payment is asserted PAID
 * directly by the cashier who is physically present for the exchange —
 * that in-person confirmation *is* the verification, unlike an online
 * payment status which can only ever come from a real gateway.
 */
export async function createPosSale(input: PosSaleInput, cashier: { id: string; name: string }) {
  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productById = new Map(products.map((p) => [p.id, p]));

  // Re-price every line from the current product data — never trust prices
  // the POS terminal UI sent, same principle as online checkout.
  let subtotalCentavos = 0;
  const lines = input.items.map((item) => {
    const product = productById.get(item.productId);
    if (!product) throw new PosSaleError("One of the items in this sale no longer exists");
    if (product.status !== "ACTIVE") throw new PosSaleError(`"${product.name}" is not available for sale`);
    const unitPrice = effectivePrice(product);
    const lineSubtotal = unitPrice * item.quantity;
    subtotalCentavos += lineSubtotal;
    return {
      productId: product.id,
      productName: product.name,
      unitPriceCentavos: unitPrice,
      unitCostCentavos: product.costCentavos,
      quantity: item.quantity,
      subtotalCentavos: lineSubtotal,
    };
  });

  if (input.discountCentavos > subtotalCentavos) {
    throw new PosSaleError("Discount can't be more than the subtotal");
  }
  const totalCentavos = subtotalCentavos - input.discountCentavos;

  if (input.paymentMethod === "cash") {
    if (input.cashReceivedCentavos === undefined || input.cashReceivedCentavos < totalCentavos) {
      throw new PosSaleError("Cash received must cover the total");
    }
  }
  const changeGivenCentavos =
    input.paymentMethod === "cash" ? (input.cashReceivedCentavos as number) - totalCentavos : null;

  // Create the order and deduct stock for every line in one transaction —
  // if stock deduction fails partway through (someone else just bought the
  // last unit), the whole sale rolls back instead of leaving a half-rung-up order.
  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          channel: "POS",
          customerName: input.customerName || null,
          subtotalCentavos,
          discountCentavos: input.discountCentavos,
          deliveryFeeCentavos: 0,
          totalCentavos,
          orderStatus: "COMPLETED",
          paymentStatus: "PAID",
          paymentMethod: input.paymentMethod,
          cashierId: cashier.id,
          cashierName: cashier.name,
          cashReceivedCentavos: input.paymentMethod === "cash" ? input.cashReceivedCentavos : null,
          changeGivenCentavos,
          items: { create: lines },
        },
        include: { items: true },
      });

      for (const line of lines) {
        await recordStockMovement(tx, {
          productId: line.productId,
          quantityChange: -line.quantity,
          type: "POS_SALE",
          orderId: created.id,
          userName: cashier.name,
        });
      }

      return created;
    });

    return order;
  } catch (err) {
    if (err instanceof InsufficientStockError) throw new PosSaleError(err.message);
    throw err;
  }
}

const STAFF_VOID_WINDOW_MS = 10 * 60_000; // staff can self-correct within 10 minutes

export class VoidNotAllowedError extends Error {}

/**
 * Voids a completed POS sale: releases the stock it deducted (as a
 * CANCELLATION movement, so the ledger shows why it came back) and marks
 * the order CANCELLED/REFUNDED. Staff may only void their own sale within
 * a short window (to correct a ring-up mistake); Manager/Owner can void
 * any POS sale at any time. A reason is always required.
 */
export async function voidPosSale(
  orderId: string,
  actor: { id: string; name: string; role: "OWNER" | "MANAGER" | "STAFF" },
  reason: string
) {
  if (!reason.trim()) throw new PosSaleError("A reason is required to void a sale");

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.channel !== "POS") throw new PosSaleError("POS sale not found");
    if (order.voidedAt) throw new PosSaleError("This sale was already voided");

    const isOwnRecentSale =
      order.cashierId === actor.id && Date.now() - order.createdAt.getTime() <= STAFF_VOID_WINDOW_MS;
    const canVoid = actor.role === "OWNER" || actor.role === "MANAGER" || isOwnRecentSale;
    if (!canVoid) {
      throw new VoidNotAllowedError(
        "Only the original cashier (within 10 minutes) or a manager/owner can void this sale"
      );
    }

    for (const item of order.items) {
      if (!item.productId) continue;
      await recordStockMovement(tx, {
        productId: item.productId,
        quantityChange: item.quantity,
        type: "CANCELLATION",
        orderId: order.id,
        userName: actor.name,
        note: `Void: ${reason}`,
      });
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        orderStatus: "CANCELLED",
        paymentStatus: "REFUNDED",
        voidedAt: new Date(),
        voidedByName: actor.name,
        voidReason: reason,
      },
    });
  });
}
