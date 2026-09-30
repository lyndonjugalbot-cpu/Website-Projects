/** The subset of Etsy's ShopReceipt (Open API v3) that claiming relies on. */
export interface EtsyReceipt {
  receipt_id: number;
  shop_id?: number;
  buyer_email?: string | null;
  status?: string;
  is_paid?: boolean;
  transactions?: { listing_id: number; quantity: number }[];
  refunds?: unknown[];
}

export interface ClaimConfig {
  shopId: string;
  /** Every listing that sells 12 months of PyWots (usually one). */
  listingIds: string[];
}

/** Upper bound on codes issued for a single order; guards against a garbage quantity. */
export const MAX_CODES_PER_ORDER = 50;

export type ReceiptEvaluation =
  | { ok: true; quantity: number; buyerEmail: string | null }
  | { ok: false; httpStatus: number; error: string };

const REJECTED_STATUSES = new Set(["canceled", "cancelled", "fully refunded", "partially refunded"]);

/** "123, 456" → ["123", "456"]. */
export function parseListingIds(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Decides whether a receipt entitles the buyer to codes, and how many (one per PyWots item).
 * The shop-scoped endpoint already 404s for other shops' receipts; `shop_id` is checked too
 * in case Etsy includes it. Other items in the same order (e.g. WotsBudgetTracker) are ignored.
 */
export function evaluateReceipt(receipt: EtsyReceipt, config: ClaimConfig): ReceiptEvaluation {
  if (receipt.shop_id !== undefined && String(receipt.shop_id) !== config.shopId) {
    return { ok: false, httpStatus: 404, error: "We couldn't find that order in our shop." };
  }
  const status = (receipt.status ?? "").toLowerCase();
  if (REJECTED_STATUSES.has(status) || (receipt.refunds?.length ?? 0) > 0) {
    return { ok: false, httpStatus: 400, error: "This order was cancelled or refunded, so it can't be claimed." };
  }
  if (receipt.is_paid !== true) {
    return { ok: false, httpStatus: 400, error: "This order hasn't been paid yet. Try again once payment has gone through." };
  }

  const listings = new Set(config.listingIds);
  let quantity = 0;
  for (const tx of receipt.transactions ?? []) {
    if (listings.has(String(tx.listing_id))) quantity += Math.max(0, Math.floor(tx.quantity));
  }
  if (quantity === 0) return { ok: false, httpStatus: 400, error: "This order doesn't include PyWots access." };
  if (quantity > MAX_CODES_PER_ORDER) {
    return { ok: false, httpStatus: 400, error: "This order is too large to claim automatically. Please message us on Etsy." };
  }

  const buyerEmail = receipt.buyer_email?.trim() ? receipt.buyer_email.trim().toLowerCase() : null;
  return { ok: true, quantity, buyerEmail };
}
