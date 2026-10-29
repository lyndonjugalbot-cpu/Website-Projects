// Pure loyalty-points helpers with no database or Node dependencies, so the
// POS screen (client) and the sale logic (server) share one set of rules.
import {
  POINTS_EARN_PESOS_PER_POINT,
  POINTS_MAX_REDEEM_PERCENT,
  POINTS_MIN_REDEEM,
  POINT_VALUE_CENTAVOS,
} from "@/lib/store-config";

/** Points earned on a sale total (centavos, after all discounts). */
export function pointsEarnedFor(totalCentavos: number): number {
  if (totalCentavos <= 0) return 0;
  return Math.floor(totalCentavos / (POINTS_EARN_PESOS_PER_POINT * 100));
}

/** Peso value, in centavos, of a number of points. */
export function pointsValueCentavos(points: number): number {
  return points * POINT_VALUE_CENTAVOS;
}

/**
 * The most points a member can spend on a sale: limited by their balance and
 * by POINTS_MAX_REDEEM_PERCENT of what is left to pay (the subtotal after any
 * manual discount). Returns 0 when they can't reach the minimum.
 */
export function maxRedeemablePoints(balance: number, payableCentavos: number): number {
  const byShare = Math.floor((payableCentavos * (POINTS_MAX_REDEEM_PERCENT / 100)) / POINT_VALUE_CENTAVOS);
  const max = Math.min(balance, byShare);
  return max >= POINTS_MIN_REDEEM ? max : 0;
}

/**
 * Normalises a Philippine mobile number to +639XXXXXXXXX. Accepts 09XXXXXXXXX,
 * 9XXXXXXXXX, 639XXXXXXXXX and +639XXXXXXXXX with spaces or dashes. Returns
 * null when it isn't a valid mobile number.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  let national: string;
  if (digits.length === 11 && digits.startsWith("09")) national = digits.slice(1);
  else if (digits.length === 12 && digits.startsWith("639")) national = digits.slice(2);
  else if (digits.length === 10 && digits.startsWith("9")) national = digits;
  else return null;
  return `+63${national}`;
}

/** "+639171234567" -> "0917 123 4567" for display. */
export function formatPhone(phone: string): string {
  const national = phone.replace(/^\+63/, "0");
  return national.length === 11 ? `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}` : phone;
}
