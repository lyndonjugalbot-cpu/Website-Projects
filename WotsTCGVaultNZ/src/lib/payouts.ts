import { prisma } from "@/lib/prisma";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { getPaymentSettings } from "@/lib/platform-settings";
import { notifyUser, notifyAdmins } from "@/lib/notify";
import { logAudit } from "@/lib/audit";
import type { Order, OrderItem } from "@prisma/client";

/**
 * Payout eligibility and release, implementing "delayed seller payout"
 * under Stripe's separate-charges-and-transfers model: the buyer's charge
 * already settled on the PLATFORM's own Stripe balance at checkout (see
 * api/checkout — no transfer_data was set). Nothing has moved to the
 * seller yet. This module is the only place that ever calls
 * `stripe.transfers.create()`, and it only does so once every condition
 * below is true.
 *
 * Payout eligibility requires ALL of:
 *  - Payment confirmed (Order.status reached PAID via webhook)
 *  - Seller's Stripe Connect account has payoutsEnabled
 *  - Delivery confirmed (tracking scan, admin, or buyer confirmation)
 *  - The buyer protection / inspection period has elapsed
 *  - No open dispute on the order
 *  - No unresolved refund in progress
 */

async function computePayoutAmounts(order: Order & { items: OrderItem[] }) {
  const settings = await getPaymentSettings();
  const bySeller = new Map<string, { grossCents: number; itemIds: string[] }>();

  for (const item of order.items) {
    const gross = item.priceCents * item.quantity;
    const existing = bySeller.get(item.sellerId) ?? { grossCents: 0, itemIds: [] };
    existing.grossCents += gross;
    existing.itemIds.push(item.id);
    bySeller.set(item.sellerId, existing);
  }

  // Shipping and the platform's fixed/commission fee were already computed
  // once at checkout and stored on the Order — split shipping evenly is
  // unnecessary here since this marketplace only ever has one seller per
  // order today, but the loop below stays correct if that ever changes.
  return Array.from(bySeller.entries()).map(([sellerId, { grossCents, itemIds }]) => {
    const reserveCents = Math.round((grossCents * settings.reserveBps) / 10000);
    return { sellerId, itemIds, grossCents, reserveCents, netCents: grossCents - reserveCents };
  });
}

/** Called when delivery is confirmed (tracking, admin, or buyer) — starts the buyer protection window. */
export async function startInspectionPeriod(orderId: string, deliveredAt: Date = new Date()) {
  const settings = await getPaymentSettings();
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, dispute: true } });
  if (!order) return;
  if (!["PAID", "AWAITING_SHIPMENT", "SHIPPED", "IN_TRANSIT"].includes(order.status)) return;

  const inspectionEndAt = new Date(deliveredAt.getTime() + settings.inspectionPeriodHours * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "INSPECTION_PERIOD",
        deliveredAt,
        inspectionStartAt: deliveredAt,
        inspectionEndAt,
      },
    });

    // Create one NOT_ELIGIBLE Payout row per seller now, so admins have
    // full visibility into "money that will eventually be owed" even
    // before it's actually eligible — see the admin transaction view.
    const amounts = await computePayoutAmounts(order);
    for (const a of amounts) {
      const existing = await tx.payout.findFirst({ where: { sellerId: a.sellerId, orderItemIds: { hasSome: a.itemIds } } });
      if (existing) continue;
      await tx.payout.create({
        data: {
          sellerId: a.sellerId,
          orderItemIds: a.itemIds,
          amountCents: a.netCents,
          status: "NOT_ELIGIBLE",
          scheduledFor: inspectionEndAt,
        },
      });
    }
  });

  const seller = await prisma.user.findUnique({ where: { id: order.items[0]?.sellerId } });
  if (seller) {
    await notifyUser({
      userId: seller.id,
      type: "ORDER_UPDATE",
      title: "Delivery confirmed — inspection period started",
      body: `Delivery has been confirmed for order #${order.id.slice(-8)}. Your payout becomes eligible after the ${settings.inspectionPeriodHours}-hour buyer protection period, provided no dispute is opened.`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/seller`,
      email: { to: seller.email, name: seller.fullName },
    });
  }
}

/** Sweep: promotes orders whose inspection period has elapsed with no open dispute to PAYOUT_ELIGIBLE. */
export async function sweepInspectionPeriods(): Promise<number> {
  const due = await prisma.order.findMany({
    where: {
      status: "INSPECTION_PERIOD",
      inspectionEndAt: { lt: new Date() },
    },
    include: { dispute: true, items: true },
  });

  let promoted = 0;
  for (const order of due) {
    if (order.dispute && order.dispute.payoutOnHold) continue; // dispute still active — stays put

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { status: "PAYOUT_ELIGIBLE", payoutEligibleAt: new Date() },
      }),
      prisma.payout.updateMany({
        where: { sellerId: { in: order.items.map((i) => i.sellerId) }, status: "NOT_ELIGIBLE" },
        data: { status: "ELIGIBLE" },
      }),
    ]);
    promoted += 1;
  }
  return promoted;
}

/**
 * Flags SHIPPED orders that have gone stale with no delivery confirmation
 * for too long, per PlatformFeeSetting.maxDeliveryWaitDays. This
 * deliberately does NOT auto-complete or auto-refund — it routes to
 * ADMIN_REVIEW because guessing wrong on undelivered-vs-lost money
 * movement is worse than a human looking at it. See docs/PAYMENTS.md
 * "where manual review is safer than automation".
 */
export async function sweepStaleDeliveries(): Promise<number> {
  const settings = await getPaymentSettings();
  const cutoff = new Date(Date.now() - settings.maxDeliveryWaitDays * 24 * 60 * 60 * 1000);

  const stale = await prisma.order.findMany({
    where: { status: { in: ["SHIPPED", "IN_TRANSIT"] }, updatedAt: { lt: cutoff } },
    select: { id: true },
  });

  for (const o of stale) {
    await prisma.order.update({
      where: { id: o.id },
      data: {
        status: "ADMIN_REVIEW",
        adminReviewNote: `No delivery confirmation ${settings.maxDeliveryWaitDays}+ days after shipment.`,
      },
    });
    await notifyAdmins({
      title: "Order needs delivery review",
      body: `Order #${o.id.slice(-8)} has had no delivery confirmation for over ${settings.maxDeliveryWaitDays} days.`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/orders`,
    });
  }
  return stale.length;
}

/**
 * Attempts the actual Stripe Transfer for one Payout row. Idempotency key
 * is derived from the payout id so a retried call (crash mid-request,
 * cron overlap) can never create two transfers for the same payout.
 */
async function executeTransfer(payoutId: string, actorId: string | null): Promise<void> {
  if (!stripeConfigured()) throw new Error("Stripe is not configured.");
  const stripe = getStripe();

  const payout = await prisma.payout.findUnique({ where: { id: payoutId }, include: { transfer: true } });
  if (!payout) throw new Error("Payout not found.");
  if (payout.status !== "ELIGIBLE" && payout.status !== "FAILED") {
    throw new Error(`Payout ${payoutId} is not eligible for release (status: ${payout.status}).`);
  }

  const payoutAccount = await prisma.sellerPayoutAccount.findUnique({ where: { userId: payout.sellerId } });
  if (!payoutAccount?.stripeConnectAccountId || !payoutAccount.payoutsEnabled) {
    throw new Error("Seller's Stripe Connect account is not eligible to receive payouts.");
  }

  const order = await prisma.order.findFirst({
    where: { items: { some: { id: { in: payout.orderItemIds } } } },
  });
  if (!order) throw new Error("Could not resolve the order for this payout.");

  const idempotencyKey = payout.idempotencyKey ?? `transfer-payout-${payout.id}`;

  await prisma.payout.update({ where: { id: payout.id }, data: { status: "PENDING", idempotencyKey } });

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: payout.amountCents,
        currency: "nzd",
        destination: payoutAccount.stripeConnectAccountId,
        transfer_group: order.id,
        metadata: { orderId: order.id, payoutId: payout.id, sellerId: payout.sellerId },
      },
      { idempotencyKey }
    );

    await prisma.$transaction([
      prisma.transfer.create({
        data: {
          orderId: order.id,
          sellerId: payout.sellerId,
          payoutId: payout.id,
          stripeTransferId: transfer.id,
          amountCents: payout.amountCents,
          status: "PAID",
          idempotencyKey,
        },
      }),
      prisma.payout.update({
        where: { id: payout.id },
        data: { status: "PAID", paidAt: new Date(), releasedManuallyBy: actorId ?? undefined },
      }),
    ]);

    await logAudit({
      actorId,
      action: "payout.release",
      targetType: "Payout",
      targetId: payout.id,
      metadata: { stripeTransferId: transfer.id, amountCents: payout.amountCents },
    });

    const seller = await prisma.user.findUnique({ where: { id: payout.sellerId } });
    if (seller) {
      await notifyUser({
        userId: seller.id,
        type: "PAYOUT",
        title: "Payout released",
        body: `Your payout of ${(payout.amountCents / 100).toFixed(2)} NZD for order #${order.id.slice(-8)} has been sent to your connected Stripe account. Arrival in your bank account follows Stripe's own payout schedule.`,
        link: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/seller`,
        email: { to: seller.email, name: seller.fullName },
      });
    }

    await checkOrderCompletion(order.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Stripe error";
    await prisma.payout.update({ where: { id: payout.id }, data: { status: "FAILED", failureReason: message } });
    await logAudit({
      actorId,
      action: "payout.release_failed",
      targetType: "Payout",
      targetId: payout.id,
      metadata: { error: message },
    });
    await notifyAdmins({
      title: "Seller payout failed",
      body: `Payout ${payout.id} for order #${order.id.slice(-8)} failed: ${message}`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/orders`,
    });
    throw err;
  }
}

/** Marks the order COMPLETED once every seller on it has been paid out. */
async function checkOrderCompletion(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  const sellerIds = Array.from(new Set(order.items.map((i) => i.sellerId)));
  const payouts = await prisma.payout.findMany({ where: { sellerId: { in: sellerIds }, orderItemIds: { hasSome: order.items.map((i) => i.id) } } });
  const allPaid = payouts.length > 0 && payouts.every((p) => p.status === "PAID");
  if (allPaid && order.status !== "COMPLETED") {
    await prisma.order.update({ where: { id: orderId }, data: { status: "COMPLETED", completedAt: new Date() } });
    const buyer = await prisma.user.findUnique({ where: { id: order.buyerId } });
    if (buyer) {
      await notifyUser({
        userId: buyer.id,
        type: "ORDER_UPDATE",
        title: "Order completed",
        body: `Order #${order.id.slice(-8)} is complete. Thanks for shopping the Vault!`,
        link: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/buyer`,
        email: { to: buyer.email, name: buyer.fullName },
      });
    }
  }
}

/**
 * Release sweep: attempts every ELIGIBLE payout, skipping (not failing)
 * ones that need manual approval per platform settings — those stay
 * ELIGIBLE and show up in the admin "needs manual release" queue.
 */
export async function releaseEligiblePayouts(): Promise<{ released: number; skipped: number; failed: number }> {
  const settings = await getPaymentSettings();
  let released = 0;
  let skipped = 0;
  let failed = 0;

  if (!settings.autoPayoutEnabled) {
    return { released: 0, skipped: 0, failed: 0 };
  }

  const eligible = await prisma.payout.findMany({ where: { status: "ELIGIBLE" }, take: 100 });
  for (const payout of eligible) {
    if (payout.amountCents > settings.maxAutoPayoutCents) {
      skipped += 1;
      continue;
    }
    // Re-check the order isn't disputed/on hold right before transferring —
    // belt-and-braces against a dispute opened in the seconds since the
    // eligibility sweep ran.
    const order = await prisma.order.findFirst({ where: { items: { some: { id: { in: payout.orderItemIds } } } }, include: { dispute: true } });
    if (order?.dispute?.payoutOnHold) {
      await prisma.payout.update({ where: { id: payout.id }, data: { status: "ON_HOLD" } });
      skipped += 1;
      continue;
    }
    try {
      await executeTransfer(payout.id, null);
      released += 1;
    } catch {
      failed += 1;
    }
  }

  return { released, skipped, failed };
}

/** Admin-triggered manual release, bypassing the auto-payout amount cap (still blocked by disputes/ineligible accounts). */
export async function releasePayoutManually(payoutId: string, adminId: string) {
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  if (!payout) throw new Error("Payout not found.");
  if (payout.status !== "ELIGIBLE" && payout.status !== "FAILED") {
    throw new Error(`Payout cannot be released from status ${payout.status}.`);
  }
  await executeTransfer(payoutId, adminId);
}

/** Places every payout tied to an order's disputed items on hold, blocking both the auto sweep and manual release. */
export async function holdPayoutsForOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  await prisma.payout.updateMany({
    where: {
      orderItemIds: { hasSome: order.items.map((i) => i.id) },
      status: { in: ["NOT_ELIGIBLE", "ELIGIBLE", "PENDING"] },
    },
    data: { status: "ON_HOLD" },
  });
}

/** Releases a hold once a dispute closes without a payout-affecting outcome. */
export async function releasePayoutHoldForOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  await prisma.payout.updateMany({
    where: { orderItemIds: { hasSome: order.items.map((i) => i.id) }, status: "ON_HOLD" },
    data: { status: order.status === "PAYOUT_ELIGIBLE" ? "ELIGIBLE" : "NOT_ELIGIBLE" },
  });
}
