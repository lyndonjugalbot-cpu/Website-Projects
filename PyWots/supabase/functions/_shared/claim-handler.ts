import { evaluateReceipt, parseListingIds, type EtsyReceipt } from "./receipt.ts";

/**
 * POST /functions/v1/claim  { receiptId, email? }  →  { codes: [{ code, plan }] }
 *
 * Verifies an Etsy order and issues one access code per PyWots item bought. Codes aren't
 * redeemed here, so extras can be gifted, and no sign-in is needed. Everything with side
 * effects comes in through `deps`, so the flow is testable without Etsy or a database
 * (see supabase/tests/claim.test.ts); claim/index.ts supplies the real ones.
 */
export interface ClaimDeps {
  env: (name: string) => string | undefined;
  /** Fixed-window limiter: true while `key` is under `limit` uses per `windowSeconds`. */
  consumeRateLimit: (key: string, limit: number, windowSeconds: number) => Promise<boolean>;
  claimExists: (receiptId: string) => Promise<boolean>;
  fetchReceipt: (receiptId: string) => Promise<{ status: "ok"; receipt: EtsyReceipt } | { status: "not_found" }>;
  /** Issues codes and records the claim atomically; null if the order was claimed meanwhile. */
  issueCodes: (count: number, receiptId: string) => Promise<string[] | null>;
  log?: (...args: unknown[]) => void;
}

export const CLAIM_RATE_LIMITS = {
  windowSeconds: 15 * 60,
  perIp: 5,
  /** Shared bucket, used only if the platform doesn't pass on the caller's IP. */
  global: 100,
  /** Stops anyone brute-forcing the buyer-email check on one known order number. */
  perReceipt: 5,
};

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || null;
}

export async function handleClaim(request: Request, deps: ClaimDeps): Promise<Response> {
  const log = deps.log ?? console.log;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });

  let body: { receiptId?: unknown; email?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Invalid request." });
  }
  const receiptId = typeof body.receiptId === "string" ? body.receiptId.replace(/[\s#]/g, "") : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  try {
    const { windowSeconds, perIp, global, perReceipt } = CLAIM_RATE_LIMITS;
    const ip = clientIp(request);
    if (!(await deps.consumeRateLimit(ip ? `claim:ip:${ip}` : "claim:global", ip ? perIp : global, windowSeconds))) {
      return json(429, { error: "Too many attempts. Please wait 15 minutes and try again." });
    }

    if (!/^\d{1,20}$/.test(receiptId)) return json(400, { error: "Enter the order number from your Etsy receipt (digits only)." });

    if (!(await deps.consumeRateLimit(`claim:receipt:${receiptId}`, perReceipt, windowSeconds))) {
      return json(429, { error: "Too many attempts for this order. Please wait 15 minutes and try again." });
    }

    if (await deps.claimExists(receiptId)) return json(409, { error: "This order has already been claimed." });

    const shopId = deps.env("ETSY_SHOP_ID");
    const listingIds = parseListingIds(deps.env("ETSY_LISTING_IDS"));
    if (!shopId || listingIds.length === 0) {
      log("claim: ETSY_SHOP_ID / ETSY_LISTING_IDS not configured");
      return json(503, { error: "Claiming is temporarily unavailable. Please try again later." });
    }

    let lookup;
    try {
      lookup = await deps.fetchReceipt(receiptId);
    } catch (error) {
      log(`claim: Etsy lookup failed for receipt ${receiptId}`, error);
      return json(502, { error: "We couldn't reach Etsy to check your order. Please try again shortly." });
    }
    if (lookup.status === "not_found") {
      return json(404, { error: "We couldn't find that order in our shop. Check the number and try again." });
    }

    const evaluation = evaluateReceipt(lookup.receipt, { shopId, listingIds });
    if (!evaluation.ok) return json(evaluation.httpStatus, { error: evaluation.error });

    if (evaluation.buyerEmail) {
      if (!email) return json(400, { error: "Enter the email address on your Etsy account.", needsEmail: true });
      if (email !== evaluation.buyerEmail) return json(403, { error: "That email doesn't match this order." });
    } else {
      log(`claim: receipt ${receiptId} exposes no buyer_email, verified by order number only`);
    }

    const codes = await deps.issueCodes(evaluation.quantity, receiptId);
    if (codes === null) return json(409, { error: "This order has already been claimed." });
    return json(200, { codes: codes.map((code) => ({ code, plan: "12m" })) });
  } catch (error) {
    log(`claim: unexpected failure for receipt ${receiptId}`, error);
    return json(500, { error: "Something went wrong on our side. Please try again, or message us on Etsy." });
  }
}
