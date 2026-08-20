import { prisma } from "@/lib/prisma";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { calculateRefundSplit } from "@/lib/money";
import { notifyUser, notifyAdmins } from "@/lib/notify";
import { logAudit } from "@/lib/audit";
import type { RefundType } from "@prisma/client";

export class RefundError extends Error {}

/**
 * Issues a refund through Stripe and records it. Handles both cases the
 * spec calls out explicitly:
 *
 *  - Refund BEFORE payout: the charge still has the full amount available
 *    on the platform's Stripe balance, so `stripe.refunds.create()` alone
 *    is sufficient — the seller's payout is simply reduced/cancelled next
 *    time payout amounts are computed (they haven't been transferred yet).
 *  - Refund AFTER payout: the seller's share already left the platform
 *    balance via a Transfer. We first attempt to reverse that Transfer
 *    (`stripe.transfers.createReversal()`) for the seller's portion, then
 *    refund the buyer's charge for the full amount. If the connected
 *    account no longer has enough balance to reverse (e.g. they were paid
 *    out further by Stripe already), the reversal fails and this function
 *    throws a RefundError instructing the caller to route to ADMIN_REVIEW
 *    for manual recovery — we never silently pretend money moved that
 *    didn't.
 */
export async function issueRefund(params: {
  orderId: string;
  amountCents: number;
  reason: string;
  type: RefundType;
  processedBy: string; // admin user id — refunds are always staff-approved, never self-service for the seller
}): Promise<{ refundId: string }> {
  if (!stripeConfigured()) throw new RefundError("Payments are not configured.");

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { payment: true, refunds: true, items: true },
  });
  if (!order || !order.payment) throw new RefundError("Order or payment not found.");
  if (!order.payment.stripeChargeId && !order.payment.stripePaymentIntentId) {
    throw new RefundError("No charge on file for this order — nothing to refund.");
  }
  if (order.payment.status === "REFUNDED") throw new RefundError("This payment has already been fully refunded.");

  const alreadyRefunded = order.refunds
    .filter((r) => r.status === "PROCESSED")
    .reduce((sum, r) => sum + r.amountCents, 0);
  const remaining = order.totalCents - alreadyRefunded;
  if (params.amountCents <= 0 || params.amountCents > remaining) {
    throw new RefundError(`Refund amount must be between $0.01 and ${(remaining / 100).toFixed(2)} NZD remaining.`);
  }

  const { platformFeeRefundCents } = calculateRefundSplit({
    refundAmountCents: params.amountCents,
    orderSubtotalCents: order.subtotalCents,
    orderShippingCents: order.shippingCents,
    platformCommissionCents: order.platformFeeCents,
  });

  const idempotencyKey = `refund-${order.id}-${params.amountCents}-${Date.now()}`;
  const stripe = getStripe();

  // --- Step 1: reverse the seller's Transfer if a payout already went out ---
  const paidTransfer = await prisma.transfer.findFirst({ where: { orderId: order.id, status: "PAID" } });
  let reversedTransferId: string | undefined;

  if (paidTransfer) {
    const sellerShareOfRefund = params.amountCents - platformFeeRefundCents;
    const reversalAmount = Math.min(sellerShareOfRefund, paidTransfer.amountCents - paidTransfer.reversedCents);

    if (reversalAmount > 0) {
      try {
        const reversal = await stripe.transfers.createReversal(
          paidTransfer.stripeTransferId!,
          { amount: reversalAmount },
          { idempotencyKey: `${idempotencyKey}-reversal` }
        );
        reversedTransferId = reversal.id;
        await prisma.transfer.update({
          where: { id: paidTransfer.id },
          data: {
            reversedCents: { increment: reversalAmount },
            status: paidTransfer.reversedCents + reversalAmount >= paidTransfer.amountCents ? "REVERSED" : "PARTIALLY_REVERSED",
          },
        });
      } catch (err) {
        // Cannot recover the seller's share automatically (e.g. their
        // connected balance is already below the amount). Flag for admin
        // recovery rather than proceeding as if nothing is owed.
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: "ADMIN_REVIEW",
            adminReviewNote: `Refund requested but transfer reversal failed: ${err instanceof Error ? err.message : "unknown error"}. Seller balance may be insufficient — manual recovery required.`,
          },
        });
        await notifyAdmins({
          title: "Refund needs manual recovery",
          body: `Order #${order.id.slice(-8)}: could not reverse the seller transfer automatically. Review and recover manually.`,
          link: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/orders`,
        });
        throw new RefundError(
          "The seller has already been paid out and the transfer could not be automatically reversed. This has been escalated for manual admin recovery."
        );
      }
    }
  }

  // --- Step 2: refund the buyer's charge on the platform account ---
  const refund = await stripe.refunds.create(
    {
      payment_intent: order.payment.stripePaymentIntentId ?? undefined,
      charge: order.payment.stripePaymentIntentId ? undefined : order.payment.stripeChargeId ?? undefined,
      amount: params.amountCents,
      reason: "requested_by_customer",
      metadata: { orderId: order.id, refundType: params.type },
    },
    { idempotencyKey }
  );

  const isFullRefund = alreadyRefunded + params.amountCents >= order.totalCents;

  const refundRecord = await prisma.$transaction(async (tx) => {
    const created = await tx.refund.create({
      data: {
        orderId: order.id,
        amountCents: params.amountCents,
        platformFeeRefundCents,
        reason: params.reason,
        type: params.type,
        isPartial: !isFullRefund,
        status: "PROCESSED",
        stripeRefundId: refund.id,
        reversedTransferId,
        idempotencyKey,
        processedBy: params.processedBy,
      },
    });

    await tx.payment.update({
      where: { orderId: order.id },
      data: {
        status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
        refundedAmountCents: { increment: params.amountCents },
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: { status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });

    return created;
  });

  await logAudit({
    actorId: params.processedBy,
    action: "refund.process",
    targetType: "Order",
    targetId: order.id,
    metadata: { amountCents: params.amountCents, type: params.type, stripeRefundId: refund.id },
  });

  const [buyer, seller] = await Promise.all([
    prisma.user.findUnique({ where: { id: order.buyerId } }),
    prisma.user.findUnique({ where: { id: order.items[0]?.sellerId } }),
  ]);

  if (buyer) {
    await notifyUser({
      userId: buyer.id,
      type: "ORDER_UPDATE",
      title: isFullRefund ? "Refund issued" : "Partial refund issued",
      body: `A refund of $${(params.amountCents / 100).toFixed(2)} NZD has been issued for order #${order.id.slice(-8)}.`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/buyer`,
      email: { to: buyer.email, name: buyer.fullName },
    });
  }
  if (seller) {
    await notifyUser({
      userId: seller.id,
      type: "ORDER_UPDATE",
      title: "A refund was issued on your sale",
      body: `Order #${order.id.slice(-8)} was refunded $${(params.amountCents / 100).toFixed(2)} NZD (of which $${(platformFeeRefundCents / 100).toFixed(2)} was platform commission). See your payout breakdown for the net effect.`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/seller`,
      email: { to: seller.email, name: seller.fullName },
    });
  }

  return { refundId: refundRecord.id };
}
