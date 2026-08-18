// The shared inventory engine — every place in the app that changes
// Product.stock (online checkout, POS sales, manual adjustments, voids)
// goes through recordStockMovement() below, so stock changes are both
// race-safe and fully logged in the StockMovement table (the "ledger").
import type { Prisma } from "@/generated/prisma/client";
import type { StockMovementType } from "@/generated/prisma/enums";

// Thrown when a stock deduction would take a product below 0 and
// allowOversell isn't set — callers (checkout, POS) turn this into a
// user-facing "out of stock" error.
export class InsufficientStockError extends Error {
  productId: string;
  productName: string;
  available: number;
  requested: number;

  constructor(params: { productId: string; productName: string; available: number; requested: number }) {
    super(`Not enough stock for "${params.productName}" (${params.available} left, ${params.requested} requested)`);
    this.productId = params.productId;
    this.productName = params.productName;
    this.available = params.available;
    this.requested = params.requested;
  }
}

type Tx = Prisma.TransactionClient;

/**
 * The single choke point for every stock change in the app — POS sales,
 * online sales, restocks, manual adjustments, cancellations, and refunds
 * all go through this. Two things make it safe under concurrency:
 *
 * 1. The stock change itself is one conditional SQL UPDATE
 *    (`WHERE stock >= qty` for deductions), not a read-then-write in JS —
 *    so two nearly-simultaneous sales of the last unit can't both "pass" a
 *    check that's already stale by the time either one writes.
 * 2. It must be called inside a `prisma.$transaction` alongside whatever
 *    else the caller is doing (creating the Order, etc.) so the stock
 *    change and the record of *why* it changed (the StockMovement row)
 *    commit atomically together.
 *
 * Throws InsufficientStockError if a deduction would take stock below 0
 * and the product doesn't have allowOversell enabled.
 */
export async function recordStockMovement(
  tx: Tx,
  params: {
    productId: string;
    quantityChange: number; // negative = deduction, positive = addition
    type: StockMovementType;
    orderId?: string;
    userName?: string | null;
    note?: string | null;
  }
): Promise<{ previousStock: number; newStock: number }> {
  const { productId, quantityChange, type, orderId, userName, note } = params;

  if (quantityChange < 0) {
    // Atomic conditional decrement: only succeeds if enough stock exists
    // (or oversell is explicitly allowed), in one round-trip.
    const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });

    // Fast-fail on the obvious case without a wasted write attempt.
    if (product.stock + quantityChange < 0 && !product.allowOversell) {
      throw new InsufficientStockError({
        productId,
        productName: product.name,
        available: product.stock,
        requested: -quantityChange,
      });
    }

    // The actual safety mechanism: one conditional UPDATE. `result.count`
    // is the ground truth — if another transaction already changed this
    // row's stock between the read above and this write, Postgres
    // re-evaluates the WHERE clause against the row's current state at
    // write time, so a now-stale condition simply won't match and count is
    // 0. There's no window where two callers can both believe they succeeded.
    const result = await tx.product.updateMany({
      where: {
        id: productId,
        ...(product.allowOversell ? {} : { stock: { gte: -quantityChange } }),
      },
      data: { stock: { increment: quantityChange } },
    });

    if (result.count === 0) {
      const fresh = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      throw new InsufficientStockError({
        productId,
        productName: fresh.name,
        available: fresh.stock,
        requested: -quantityChange,
      });
    }

    const updated = await tx.product.findUniqueOrThrow({ where: { id: productId } });
    await tx.stockMovement.create({
      data: {
        productId,
        previousStock: product.stock,
        quantityChange,
        newStock: updated.stock,
        type,
        orderId,
        userName: userName ?? null,
        note: note ?? null,
      },
    });
    return { previousStock: product.stock, newStock: updated.stock };
  }

  // Additions (restock, return, refund reversal, cancellation release) never
  // conflict with a lower bound, so a plain increment is safe.
  const before = await tx.product.findUniqueOrThrow({ where: { id: productId } });
  const updated = await tx.product.update({
    where: { id: productId },
    data: { stock: { increment: quantityChange } },
  });
  await tx.stockMovement.create({
    data: {
      productId,
      previousStock: before.stock,
      quantityChange,
      newStock: updated.stock,
      type,
      orderId,
      userName: userName ?? null,
      note: note ?? null,
    },
  });
  return { previousStock: before.stock, newStock: updated.stock };
}
