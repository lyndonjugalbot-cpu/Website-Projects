import { prisma } from "@/lib/prisma";
import { holdPayoutsForOrder, releasePayoutHoldForOrder } from "@/lib/payouts";
import { issueRefund } from "@/lib/refunds";
import { notifyUser, notifyAdmins } from "@/lib/notify";
import { logAudit } from "@/lib/audit";
import type { DisputeStatus } from "@prisma/client";

const SELLER_RESPONSE_WINDOW_DAYS = 3;

export class DisputeError extends Error {}

/** Buyer-filed in-app dispute (not a Stripe chargeback — see handleStripeChargebackCreated for that). */
export async function openBuyerDispute(params: {
  orderId: string;
  filedById: string;
  reason: string;
  description: string;
}) {
  const order = await prisma.order.findUnique({ where: { id: params.orderId }, include: { dispute: true, items: true } });
  if (!order) throw new DisputeError("Order not found.");
  if (order.buyerId !== params.filedById) throw new DisputeError("Only the buyer on this order can open a dispute.");
  if (order.dispute) throw new DisputeError("A dispute already exists for this order.");
  if (!["DELIVERED", "INSPECTION_PERIOD", "SHIPPED", "IN_TRANSIT"].includes(order.status)) {
    throw new DisputeError("This order is not eligible for a dispute in its current state.");
  }

  const dispute = await prisma.$transaction(async (tx) => {
    const created = await tx.dispute.create({
      data: {
        orderId: order.id,
        filedById: params.filedById,
        source: "BUYER",
        reason: params.reason,
        description: params.description,
        status: "SELLER_RESPONSE_REQUIRED",
        payoutOnHold: true,
        evidenceDueBy: new Date(Date.now() + SELLER_RESPONSE_WINDOW_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    await tx.order.update({ where: { id: order.id }, data: { status: "DISPUTED" } });
    return created;
  });

  await holdPayoutsForOrder(order.id);

  const seller = await prisma.user.findUnique({ where: { id: order.items[0]?.sellerId } });
  if (seller) {
    await notifyUser({
      userId: seller.id,
      type: "DISPUTE",
      title: "A buyer opened a dispute on your sale",
      body: `Order #${order.id.slice(-8)} has an open dispute (${params.reason}). Please respond within ${SELLER_RESPONSE_WINDOW_DAYS} days. Your payout for this order is on hold until it's resolved.`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/seller`,
      email: { to: seller.email, name: seller.fullName },
    });
  }
  await notifyAdmins({
    title: "New dispute opened",
    body: `Order #${order.id.slice(-8)}: ${params.reason}`,
    link: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/disputes`,
  });
  await logAudit({ actorId: params.filedById, action: "dispute.open", targetType: "Dispute", targetId: dispute.id });

  return dispute;
}

export async function addDisputeEvidence(params: { disputeId: string; uploadedBy: string; url: string; note?: string }) {
  await prisma.disputeEvidence.create({
    data: { disputeId: params.disputeId, uploadedBy: params.uploadedBy, url: params.url, note: params.note },
  });
}

export async function submitSellerResponse(params: { disputeId: string; sellerId: string; response: string }) {
  const dispute = await prisma.dispute.findUnique({ where: { id: params.disputeId }, include: { order: { include: { items: true } } } });
  if (!dispute) throw new DisputeError("Dispute not found.");
  if (dispute.order.items[0]?.sellerId !== params.sellerId) throw new DisputeError("Not authorized on this dispute.");

  await prisma.dispute.update({
    where: { id: params.disputeId },
    data: { status: "UNDER_REVIEW", sellerRespondedAt: new Date(), sellerResponse: params.response },
  });

  await notifyAdmins({
    title: "Seller responded to dispute",
    body: `Order #${dispute.orderId.slice(-8)} dispute now awaiting admin review.`,
    link: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/disputes`,
  });
}

/**
 * Admin resolution. `refundCents` (if any) is processed through the normal
 * refund path so it gets the same transfer-reversal safety as any other
 * refund. Resolving to CLOSED/RESOLVED_SELLER releases the payout hold;
 * RESOLVED_BUYER/PARTIAL_REFUND keep the order out of the payout pool for
 * whatever wasn't refunded (handled by the refund itself reducing what's
 * transferable).
 */
export async function resolveDispute(params: {
  disputeId: string;
  resolvedBy: string;
  outcome: Extract<DisputeStatus, "RESOLVED_BUYER" | "RESOLVED_SELLER" | "PARTIAL_REFUND" | "CLOSED">;
  resolutionNotes?: string;
  internalNotes?: string;
  refundCents?: number;
}) {
  const dispute = await prisma.dispute.findUnique({ where: { id: params.disputeId }, include: { order: true } });
  if (!dispute) throw new DisputeError("Dispute not found.");

  if ((params.outcome === "RESOLVED_BUYER" || params.outcome === "PARTIAL_REFUND") && params.refundCents) {
    await issueRefund({
      orderId: dispute.orderId,
      amountCents: params.refundCents,
      reason: `Dispute resolution: ${params.resolutionNotes ?? params.outcome}`,
      type: params.outcome === "RESOLVED_BUYER" ? "FULL" : "PARTIAL",
      processedBy: params.resolvedBy,
    });
  }

  await prisma.dispute.update({
    where: { id: params.disputeId },
    data: {
      status: params.outcome,
      payoutOnHold: false,
      resolutionNotes: params.resolutionNotes,
      internalNotes: params.internalNotes,
      refundDecisionCents: params.refundCents,
      resolvedBy: params.resolvedBy,
      resolvedAt: new Date(),
    },
  });

  // Refunded orders are already terminal (REFUNDED/PARTIALLY_REFUNDED) from
  // issueRefund; a seller-favoured or closed-with-no-refund outcome needs
  // to re-enter the normal payout pipeline instead.
  const refreshedOrder = await prisma.order.findUnique({ where: { id: dispute.orderId } });
  if (refreshedOrder && (refreshedOrder.status === "DISPUTED")) {
    await prisma.order.update({
      where: { id: dispute.orderId },
      data: { status: refreshedOrder.payoutEligibleAt ? "PAYOUT_ELIGIBLE" : "INSPECTION_PERIOD" },
    });
    await releasePayoutHoldForOrder(dispute.orderId);
  }

  await logAudit({
    actorId: params.resolvedBy,
    action: "dispute.resolve",
    targetType: "Dispute",
    targetId: dispute.id,
    metadata: { outcome: params.outcome, refundCents: params.refundCents },
  });

  const [buyer, order] = await Promise.all([
    prisma.user.findUnique({ where: { id: dispute.filedById } }),
    prisma.order.findUnique({ where: { id: dispute.orderId }, include: { items: true } }),
  ]);
  const seller = order ? await prisma.user.findUnique({ where: { id: order.items[0]?.sellerId } }) : null;

  for (const [user, label] of [
    [buyer, "buyer"],
    [seller, "seller"],
  ] as const) {
    if (!user) continue;
    await notifyUser({
      userId: user.id,
      type: "DISPUTE",
      title: "Dispute resolved",
      body: `The dispute on order #${dispute.orderId.slice(-8)} has been resolved.${params.resolutionNotes ? ` ${params.resolutionNotes}` : ""}`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/${label === "buyer" ? "buyer" : "seller"}`,
      email: { to: user.email, name: user.fullName },
    });
  }
}
