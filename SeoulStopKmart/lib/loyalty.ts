// Server-side loyalty-points logic: signing members up, looking them up at the
// register, resetting PINs, manual adjustments, and the public balance check.
// Earning and redeeming happen inside the POS sale transaction (lib/pos.ts).
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/loyalty-math";
import { POINTS_LOCK_MINUTES, POINTS_MAX_PIN_ATTEMPTS } from "@/lib/store-config";

export class LoyaltyError extends Error {}

/** A random 4-digit PIN, e.g. "0482". Shown once to the cashier, stored hashed. */
export function generatePin(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

export type MemberSummary = { id: string; name: string; phone: string; points: number };

const memberSelect = { id: true, name: true, phone: true, points: true } as const;

/** Finds members by phone number (any common format) or by name. */
export async function searchMembers(query: string): Promise<MemberSummary[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const digits = q.replace(/[^\d]/g, "");
  const normalized = normalizePhone(q);
  return prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        ...(normalized ? [{ phone: normalized }] : []),
        ...(digits.length >= 4 ? [{ phone: { contains: digits.replace(/^0/, "") } }] : []),
      ],
    },
    select: memberSelect,
    orderBy: { name: "asc" },
    take: 8,
  });
}

/** Signs up a new member. Returns the member and their PIN (only time it is visible). */
export async function enrollMember(input: { name: string; phone: string }, staffName: string) {
  const name = input.name.trim();
  if (!name) throw new LoyaltyError("Enter the customer's name");
  const phone = normalizePhone(input.phone);
  if (!phone) throw new LoyaltyError("Enter a valid mobile number, e.g. 0917 123 4567");

  const existing = await prisma.customer.findUnique({ where: { phone }, select: { name: true } });
  if (existing) throw new LoyaltyError(`That number is already a member (${existing.name})`);

  const pin = generatePin();
  const customer = await prisma.customer.create({
    data: { name, phone, pinHash: await bcrypt.hash(pin, 10), createdByName: staffName },
    select: memberSelect,
  });
  return { customer, pin };
}

/** Gives a member a new PIN (they forgot it). Also clears any lockout. */
export async function resetMemberPin(customerId: string) {
  const pin = generatePin();
  try {
    await prisma.customer.update({
      where: { id: customerId },
      data: { pinHash: await bcrypt.hash(pin, 10), failedPinAttempts: 0, lockedUntil: null },
    });
  } catch {
    throw new LoyaltyError("Member not found");
  }
  return pin;
}

/** Manager/owner correction of a member's balance, always with a reason. */
export async function adjustMemberPoints(
  customerId: string,
  points: number,
  note: string,
  userName: string
) {
  if (!Number.isInteger(points) || points === 0) throw new LoyaltyError("Enter a number of points to add or remove");
  if (!note.trim()) throw new LoyaltyError("A reason is required");

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new LoyaltyError("Member not found");
    const balanceAfter = customer.points + points;
    if (balanceAfter < 0) throw new LoyaltyError(`They only have ${customer.points} points`);
    await tx.customer.update({
      where: { id: customerId },
      data: { points: balanceAfter, ...(points > 0 ? { lifetimePoints: { increment: points } } : {}) },
    });
    await tx.pointsTransaction.create({
      data: { customerId, type: "ADJUST", points, balanceAfter, note: note.trim(), userName },
    });
    return balanceAfter;
  });
}

export type PointsLookupResult =
  | {
      ok: true;
      name: string;
      points: number;
      lifetimePoints: number;
      history: { id: string; type: string; points: number; balanceAfter: number; createdAt: string }[];
    }
  | { ok: false; error: string };

const GENERIC_FAILURE = "That phone number and PIN don't match. Check them and try again.";

/**
 * Public balance check. Wrong PINs count against the member's account, which
 * locks for a while after POINTS_MAX_PIN_ATTEMPTS misses so a PIN can't be
 * guessed. Unknown numbers and wrong PINs get the same message.
 */
export async function lookupPoints(phoneInput: string, pin: string): Promise<PointsLookupResult> {
  const phone = normalizePhone(phoneInput);
  if (!phone || !/^\d{4}$/.test(pin)) return { ok: false, error: GENERIC_FAILURE };

  const customer = await prisma.customer.findUnique({ where: { phone } });
  if (!customer) return { ok: false, error: GENERIC_FAILURE };

  if (customer.lockedUntil && customer.lockedUntil > new Date()) {
    const minutes = Math.ceil((customer.lockedUntil.getTime() - Date.now()) / 60_000);
    return { ok: false, error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or ask at the store.` };
  }

  if (!(await bcrypt.compare(pin, customer.pinHash))) {
    const attempts = customer.failedPinAttempts + 1;
    const lock = attempts >= POINTS_MAX_PIN_ATTEMPTS;
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        failedPinAttempts: lock ? 0 : attempts,
        lockedUntil: lock ? new Date(Date.now() + POINTS_LOCK_MINUTES * 60_000) : null,
      },
    });
    return { ok: false, error: GENERIC_FAILURE };
  }

  if (customer.failedPinAttempts > 0 || customer.lockedUntil) {
    await prisma.customer.update({ where: { id: customer.id }, data: { failedPinAttempts: 0, lockedUntil: null } });
  }

  const history = await prisma.pointsTransaction.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  return {
    ok: true,
    name: customer.name,
    points: customer.points,
    lifetimePoints: customer.lifetimePoints,
    history: history.map((h) => ({
      id: h.id,
      type: h.type,
      points: h.points,
      balanceAfter: h.balanceAfter,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}
