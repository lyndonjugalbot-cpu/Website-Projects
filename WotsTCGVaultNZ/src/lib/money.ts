/**
 * All money in this codebase is an integer count of NZD cents. Never use
 * floating-point arithmetic for money — every function here operates on
 * and returns integers, and `Math.round` is only ever used to collapse a
 * bps (basis-point) percentage calculation back to a whole cent, never to
 * "fix up" an already-lossy float.
 */

export type FeeBreakdown = {
  subtotalCents: number;
  shippingCents: number;
  buyerFeeCents: number;
  totalCents: number;
  platformCommissionCents: number;
  platformFixedFeeCents: number;
  reserveCents: number;
  sellerNetCents: number;
};

export function bpsOf(amountCents: number, bps: number): number {
  // integer-only: (amount * bps) / 10000, rounded to the nearest cent.
  return Math.round((amountCents * bps) / 10000);
}

/**
 * Computes the full buyer-facing and seller-facing breakdown for a single
 * order line server-side. This is the ONLY place fee math should happen —
 * never trust a client-supplied total.
 */
export function calculateFeeBreakdown(params: {
  subtotalCents: number;
  shippingCents: number;
  platformCommissionBps: number;
  platformFixedFeeCents: number;
  buyerPaysFees: boolean;
  buyerFeeBps: number;
  reserveBps: number;
}): FeeBreakdown {
  const {
    subtotalCents,
    shippingCents,
    platformCommissionBps,
    platformFixedFeeCents,
    buyerPaysFees,
    buyerFeeBps,
    reserveBps,
  } = params;

  const platformCommissionCents = bpsOf(subtotalCents, platformCommissionBps);
  const buyerFeeCents = buyerPaysFees ? bpsOf(subtotalCents + shippingCents, buyerFeeBps) : 0;
  const totalCents = subtotalCents + shippingCents + buyerFeeCents;

  const grossSellerCents = subtotalCents + shippingCents - platformCommissionCents - platformFixedFeeCents;
  const reserveCents = Math.max(0, bpsOf(Math.max(grossSellerCents, 0), reserveBps));
  const sellerNetCents = Math.max(0, grossSellerCents - reserveCents);

  return {
    subtotalCents,
    shippingCents,
    buyerFeeCents,
    totalCents,
    platformCommissionCents,
    platformFixedFeeCents,
    reserveCents,
    sellerNetCents,
  };
}

/**
 * Pro-rates a refund's platform-fee and seller-proceeds split for partial
 * refunds — e.g. refunding 40% of the item price gives back 40% of the
 * platform commission too, rather than the platform keeping its full cut
 * on a partially-refunded sale.
 */
export function calculateRefundSplit(params: {
  refundAmountCents: number;
  orderSubtotalCents: number;
  orderShippingCents: number;
  platformCommissionCents: number;
}): { platformFeeRefundCents: number; sellerDeductionCents: number } {
  const orderTotal = params.orderSubtotalCents + params.orderShippingCents;
  if (orderTotal <= 0) return { platformFeeRefundCents: 0, sellerDeductionCents: params.refundAmountCents };

  const proportion = Math.min(1, params.refundAmountCents / orderTotal);
  const platformFeeRefundCents = Math.round(params.platformCommissionCents * proportion);
  const sellerDeductionCents = params.refundAmountCents - platformFeeRefundCents;

  return { platformFeeRefundCents, sellerDeductionCents };
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(cents / 100);
}
