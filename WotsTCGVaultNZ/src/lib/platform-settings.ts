import { prisma } from "@/lib/prisma";

/**
 * Admin-configurable marketplace payment settings, persisted as a JSON row
 * in the existing `PlatformSetting` table (key = "payment_settings") rather
 * than a new table, so this reuses the admin settings mechanism that
 * already existed instead of introducing a second, competing one.
 *
 * Cached in-process for a short TTL so the checkout/payout hot paths don't
 * take a DB round trip on every call — admin changes take effect within
 * `CACHE_TTL_MS`, which is an acceptable trade-off for fee configuration
 * (not something that needs to be instantaneous).
 */
export type PlatformPaymentSettings = {
  platformCommissionBps: number; // marketplace commission on item subtotal, e.g. 800 = 8%
  platformFixedFeeCents: number; // flat fee added per order, on top of the commission
  buyerPaysFees: boolean; // if true, a buyer-facing fee surcharge line is added at checkout
  buyerFeeBps: number; // surcharge rate, only applied when buyerPaysFees is true
  reserveBps: number; // rolling reserve withheld from each seller payout
  inspectionPeriodHours: number; // buyer protection / inspection window after confirmed delivery
  autoPayoutEnabled: boolean; // if false, ALL payouts require manual admin release
  maxAutoPayoutCents: number; // payouts above this amount always require manual approval
  maxDeliveryWaitDays: number; // days after SHIPPED with no delivery confirmation before ADMIN_REVIEW
  reservationTtlMinutes: number; // how long a listing stays reserved during checkout
};

export const DEFAULT_PAYMENT_SETTINGS: PlatformPaymentSettings = {
  platformCommissionBps: 800,
  platformFixedFeeCents: 0,
  buyerPaysFees: false,
  buyerFeeBps: 290,
  reserveBps: 500,
  inspectionPeriodHours: 48,
  autoPayoutEnabled: true,
  maxAutoPayoutCents: 500_000, // $5,000 NZD
  maxDeliveryWaitDays: 30,
  reservationTtlMinutes: 30, // matches Stripe Checkout Session's own 30-minute minimum expiry
};

const SETTINGS_KEY = "payment_settings";
const CACHE_TTL_MS = 60_000;

let cache: { value: PlatformPaymentSettings; expiresAt: number } | null = null;

export async function getPaymentSettings(): Promise<PlatformPaymentSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const stored = await prisma.platformSetting.findUnique({ where: { key: SETTINGS_KEY } });
  const value: PlatformPaymentSettings = {
    ...DEFAULT_PAYMENT_SETTINGS,
    ...((stored?.value as Partial<PlatformPaymentSettings>) ?? {}),
  };

  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function updatePaymentSettings(
  patch: Partial<PlatformPaymentSettings>,
  updatedBy: string
): Promise<PlatformPaymentSettings> {
  const current = await getPaymentSettings();
  const next = { ...current, ...patch };

  await prisma.platformSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: next, updatedBy },
    create: { key: SETTINGS_KEY, value: next, updatedBy },
  });

  cache = { value: next, expiresAt: Date.now() + CACHE_TTL_MS };
  return next;
}
