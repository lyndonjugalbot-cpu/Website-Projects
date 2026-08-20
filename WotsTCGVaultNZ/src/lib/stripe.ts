import Stripe from "stripe";

/**
 * Marketplace payments run through Stripe Connect (Express accounts).
 * Requires STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in production — see
 * .env.example. Throws lazily (only when actually used) so the app can
 * still boot / build without live keys during local development.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Payments are disabled until it is configured."
    );
  }
  _stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  return _stripe;
}

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
