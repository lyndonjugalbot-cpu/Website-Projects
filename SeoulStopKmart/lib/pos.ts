// Business logic for the in-store POS (/admin/pos) — ringing up a sale,
// voiding one and refunding one. Called from app/api/admin/pos/route.ts and
// app/api/admin/pos/[id]/{void,refund}/route.ts, which handle auth/HTTP
// concerns and delegate the actual work here.
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { effectivePrice } from "@/lib/types";
import { InsufficientStockError, recordStockMovement } from "@/lib/inventory";
import { maxRedeemablePoints, pointsEarnedFor, pointsValueCentavos } from "@/lib/loyalty-math";
import { POINTS_MIN_REDEEM } from "@/lib/store-config";

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
  paymentMethod: z.enum(["cash", "gcash", "paymaya", "bank_transfer", "split"]),
  cashReceivedCentavos: z.number().int().min(0).optional(),
  // Split (cash + GCash) only: the part paid by GCash. Cash covers the rest.
  gcashAmountCentavos: z.number().int().min(0).optional(),
  customerName: z.string().trim().max(200).optional().or(z.literal("")),
  // Loyalty member attached to the sale, and how many of their points to spend.
  customerId: z.string().min(1).optional(),
  pointsToRedeem: z.number().int().min(0).default(0),
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

  // Loyalty member: validate the points being spent against their balance and
  // the redemption limits. Checked again atomically inside the transaction.
  const member = input.customerId
    ? await prisma.customer.findUnique({ where: { id: input.customerId } })
    : null;
  if (input.customerId && !member) throw new PosSaleError("That member could not be found");
  const pointsRedeemed = member ? input.pointsToRedeem : 0;
  if (pointsRedeemed > 0) {
    if (pointsRedeemed < POINTS_MIN_REDEEM) throw new PosSaleError(`Redeem at least ${POINTS_MIN_REDEEM} points`);
    if (pointsRedeemed > member!.points) throw new PosSaleError(`${member!.name} only has ${member!.points} points`);
    const allowed = maxRedeemablePoints(member!.points, subtotalCentavos - input.discountCentavos);
    if (pointsRedeemed > allowed) throw new PosSaleError(`Points can cover at most ${allowed} points on this sale`);
  } else if (input.pointsToRedeem > 0) {
    throw new PosSaleError("Choose a member before redeeming points");
  }
  const pointsDiscountCentavos = pointsValueCentavos(pointsRedeemed);
  const totalDiscountCentavos = input.discountCentavos + pointsDiscountCentavos;
  const totalCentavos = subtotalCentavos - totalDiscountCentavos;
  const pointsEarned = member ? pointsEarnedFor(totalCentavos) : 0;

  // Split payments: GCash takes part of the total and cash covers the rest,
  // so both parts must be more than zero (otherwise it's a plain sale).
  const isSplit = input.paymentMethod === "split";
  const gcashAmountCentavos = isSplit ? input.gcashAmountCentavos ?? 0 : null;
  if (isSplit && (gcashAmountCentavos! <= 0 || gcashAmountCentavos! >= totalCentavos)) {
    throw new PosSaleError("For a split payment, the GCash amount must be more than zero and less than the total");
  }
  const cashDueCentavos = input.paymentMethod === "cash" ? totalCentavos : isSplit ? totalCentavos - gcashAmountCentavos! : null;
  if (cashDueCentavos !== null) {
    if (input.cashReceivedCentavos === undefined || input.cashReceivedCentavos < cashDueCentavos) {
      throw new PosSaleError(isSplit ? "Cash received must cover the cash part of the payment" : "Cash received must cover the total");
    }
  }
  const changeGivenCentavos = cashDueCentavos !== null ? (input.cashReceivedCentavos as number) - cashDueCentavos : null;

  // Create the order and deduct stock for every line in one transaction —
  // if stock deduction fails partway through (someone else just bought the
  // last unit), the whole sale rolls back instead of leaving a half-rung-up order.
  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          channel: "POS",
          customerName: input.customerName || member?.name || null,
          phone: member?.phone ?? null,
          customerId: member?.id ?? null,
          pointsEarned,
          pointsRedeemed,
          pointsDiscountCentavos,
          subtotalCentavos,
          discountCentavos: totalDiscountCentavos,
          deliveryFeeCentavos: 0,
          totalCentavos,
          orderStatus: "COMPLETED",
          paymentStatus: "PAID",
          paymentMethod: input.paymentMethod,
          cashierId: cashier.id,
          cashierName: cashier.name,
          cashReceivedCentavos: cashDueCentavos !== null ? input.cashReceivedCentavos : null,
          changeGivenCentavos,
          gcashAmountCentavos,
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

      // Spend and earn the member's points. The guarded update stops a balance
      // from going negative if two registers redeem at the same moment.
      if (member) {
        if (pointsRedeemed > 0) {
          const spent = await tx.customer.updateMany({
            where: { id: member.id, points: { gte: pointsRedeemed } },
            data: { points: { decrement: pointsRedeemed } },
          });
          if (spent.count === 0) throw new PosSaleError(`${member.name} no longer has enough points`);
        }
        const updated = await tx.customer.update({
          where: { id: member.id },
          data: pointsEarned > 0 ? { points: { increment: pointsEarned }, lifetimePoints: { increment: pointsEarned } } : {},
        });
        const balanceAfterRedeem = updated.points - pointsEarned;
        if (pointsRedeemed > 0) {
          await tx.pointsTransaction.create({
            data: {
              customerId: member.id,
              type: "REDEEM",
              points: -pointsRedeemed,
              balanceAfter: balanceAfterRedeem,
              orderId: created.id,
              userName: cashier.name,
            },
          });
        }
        if (pointsEarned > 0) {
          await tx.pointsTransaction.create({
            data: {
              customerId: member.id,
              type: "EARN",
              points: pointsEarned,
              balanceAfter: updated.points,
              orderId: created.id,
              userName: cashier.name,
            },
          });
        }
        await tx.order.update({ where: { id: created.id }, data: { pointsBalanceAfter: updated.points } });
      }

      return created;
    });

    return order;
  } catch (err) {
    if (err instanceof InsufficientStockError) throw new PosSaleError(err.message);
    throw err;
  }
}

export class VoidNotAllowedError extends Error {}

type Actor = { id: string; name: string; role: "OWNER" | "MANAGER" | "STAFF" };

/** Voids and refunds hand money back, so only a manager or owner may do them. */
export function canRefund(role: Actor["role"]) {
  return role === "OWNER" || role === "MANAGER";
}

/**
 * Voids a completed POS sale: releases the stock it deducted (as a
 * CANCELLATION movement, so the ledger shows why it came back) and marks
 * the order CANCELLED/REFUNDED. Manager/Owner only — a void hands the whole
 * sale back, so it is a refund in all but name. A reason is always required.
 */
export async function voidPosSale(orderId: string, actor: Actor, reason: string) {
  if (!reason.trim()) throw new PosSaleError("A reason is required to void a sale");
  if (!canRefund(actor.role)) throw new VoidNotAllowedError("Only a manager or owner can void a sale");

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.channel !== "POS") throw new PosSaleError("POS sale not found");
    if (order.voidedAt) throw new PosSaleError("This sale was already voided");
    // Voiding would put every item back in stock again, on top of the refunded ones.
    if (order.refundedCentavos > 0) throw new PosSaleError("Part of this sale was refunded — refund the remaining items instead");

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

    // Take back the points this sale earned and give back the ones it spent.
    if (order.customerId && (order.pointsEarned > 0 || order.pointsRedeemed > 0)) {
      const customer = await tx.customer.findUnique({ where: { id: order.customerId } });
      if (customer) {
        const takeBack = Math.min(order.pointsEarned, customer.points + order.pointsRedeemed);
        let balance = customer.points;
        if (order.pointsRedeemed > 0) {
          balance += order.pointsRedeemed;
          await tx.pointsTransaction.create({
            data: {
              customerId: customer.id,
              type: "VOID_REDEEM",
              points: order.pointsRedeemed,
              balanceAfter: balance,
              orderId: order.id,
              note: `Void: ${reason}`,
              userName: actor.name,
            },
          });
        }
        if (takeBack > 0) {
          balance -= takeBack;
          await tx.pointsTransaction.create({
            data: {
              customerId: customer.id,
              type: "VOID_EARN",
              points: -takeBack,
              balanceAfter: balance,
              orderId: order.id,
              note: `Void: ${reason}`,
              userName: actor.name,
            },
          });
        }
        await tx.customer.update({
          where: { id: customer.id },
          data: { points: balance, lifetimePoints: Math.max(0, customer.lifetimePoints - takeBack) },
        });
      }
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

// Validates the request body for POST /api/admin/pos/[id]/refund.
export const refundInputSchema = z.object({
  items: z
    .array(z.object({ orderItemId: z.string().min(1), quantity: z.number().int().min(1).max(999) }))
    .min(1, "Choose at least one item to refund"),
  method: z.enum(["cash", "gcash"]),
  reason: z.string().trim().min(1, "A reason is required"),
});

export type RefundInput = z.infer<typeof refundInputSchema>;

/**
 * Refunds some or all items of a completed POS sale (Manager/Owner only).
 * The refunded units go back into stock (REFUND movements), and the money
 * paid back is that share of what the customer actually paid — order-level
 * discounts and points are spread across the items by value.
 *
 * Amounts are worked out cumulatively ("everything refunded so far should
 * be worth X") rather than per refund, so several partial refunds add up to
 * exactly the sale total with no rounding left over. The same goes for
 * loyalty points: the used points come back in proportion, and earned
 * points are trimmed to what the remaining sale would have earned.
 */
export async function refundPosSale(orderId: string, actor: Actor, input: RefundInput) {
  if (!canRefund(actor.role)) throw new VoidNotAllowedError("Only a manager or owner can process a refund");

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.channel !== "POS") throw new PosSaleError("POS sale not found");
    if (order.voidedAt) throw new PosSaleError("This sale was voided — there is nothing left to refund");
    if (order.paymentStatus !== "PAID") throw new PosSaleError("This sale has already been fully refunded");

    const itemById = new Map(order.items.map((i) => [i.id, i]));
    const refundedQty = new Map(order.items.map((i) => [i.id, i.refundedQuantity]));
    const refundedLines: { orderItemId: string; productName: string; quantity: number }[] = [];
    for (const line of input.items) {
      const item = itemById.get(line.orderItemId);
      if (!item) throw new PosSaleError("One of the items is not part of this sale");
      const left = item.quantity - refundedQty.get(item.id)!;
      if (line.quantity > left) {
        throw new PosSaleError(`Only ${left} of "${item.productName}" can still be refunded`);
      }
      refundedQty.set(item.id, refundedQty.get(item.id)! + line.quantity);
      refundedLines.push({ orderItemId: item.id, productName: item.productName, quantity: line.quantity });
    }

    // Share of the sale (by line value) that has been refunded after this refund.
    const refundedValue = order.items.reduce((sum, i) => sum + i.unitPriceCentavos * refundedQty.get(i.id)!, 0);
    const isFull = order.items.every((i) => refundedQty.get(i.id) === i.quantity);
    const share = order.subtotalCentavos > 0 ? refundedValue / order.subtotalCentavos : 1;
    const targetRefunded = isFull ? order.totalCentavos : Math.round(order.totalCentavos * share);
    const amountCentavos = targetRefunded - order.refundedCentavos;

    for (const line of refundedLines) {
      await tx.orderItem.update({
        where: { id: line.orderItemId },
        data: { refundedQuantity: { increment: line.quantity } },
      });
      const productId = itemById.get(line.orderItemId)!.productId;
      if (!productId) continue; // product since deleted — nothing to restock
      await recordStockMovement(tx, {
        productId,
        quantityChange: line.quantity,
        type: "REFUND",
        orderId: order.id,
        userName: actor.name,
        note: `Refund: ${input.reason}`,
      });
    }

    // Loyalty points, trued up against what earlier refunds already moved.
    if (order.customerId && (order.pointsEarned > 0 || order.pointsRedeemed > 0)) {
      const customer = await tx.customer.findUnique({ where: { id: order.customerId } });
      if (customer) {
        const earlier = await tx.pointsTransaction.groupBy({
          by: ["type"],
          where: { orderId: order.id, type: { in: ["VOID_EARN", "VOID_REDEEM"] } },
          _sum: { points: true },
        });
        const moved = (t: string) => Math.abs(earlier.find((e) => e.type === t)?._sum.points ?? 0);
        const returnTarget = isFull ? order.pointsRedeemed : Math.floor(order.pointsRedeemed * share);
        const takeBackTarget = order.pointsEarned - pointsEarnedFor(order.totalCentavos - targetRefunded);
        const giveBack = Math.max(0, returnTarget - moved("VOID_REDEEM"));
        let balance = customer.points + giveBack;
        const takeBack = Math.min(Math.max(0, takeBackTarget - moved("VOID_EARN")), balance);
        if (giveBack > 0) {
          await tx.pointsTransaction.create({
            data: {
              customerId: customer.id,
              type: "VOID_REDEEM",
              points: giveBack,
              balanceAfter: balance,
              orderId: order.id,
              note: `Refund: ${input.reason}`,
              userName: actor.name,
            },
          });
        }
        if (takeBack > 0) {
          balance -= takeBack;
          await tx.pointsTransaction.create({
            data: {
              customerId: customer.id,
              type: "VOID_EARN",
              points: -takeBack,
              balanceAfter: balance,
              orderId: order.id,
              note: `Refund: ${input.reason}`,
              userName: actor.name,
            },
          });
        }
        if (giveBack > 0 || takeBack > 0) {
          await tx.customer.update({
            where: { id: customer.id },
            data: { points: balance, lifetimePoints: Math.max(0, customer.lifetimePoints - takeBack) },
          });
        }
      }
    }

    const refund = await tx.refund.create({
      data: {
        orderId: order.id,
        amountCentavos,
        method: input.method,
        reason: input.reason,
        items: refundedLines,
        refundedById: actor.id,
        refundedByName: actor.name,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        refundedCentavos: targetRefunded,
        ...(isFull ? { paymentStatus: "REFUNDED" as const } : {}),
        lastUpdatedByName: actor.name,
      },
    });

    return refund;
  });
}
