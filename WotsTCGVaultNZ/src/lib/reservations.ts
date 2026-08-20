import { prisma } from "@/lib/prisma";
import { getPaymentSettings } from "@/lib/platform-settings";

/**
 * Listing reservation / inventory protection.
 *
 * The atomic guard is a single `UPDATE ... WHERE quantity - "reservedQuantity"
 * >= $qty` executed via `$executeRaw`. Postgres takes a row lock for the
 * duration of that UPDATE, so two concurrent checkout requests for the last
 * unit of a one-of-one listing cannot both succeed — the second one's
 * WHERE clause simply won't match once the first has incremented
 * reservedQuantity, and `$executeRaw` reports 0 rows affected. This is a
 * standard optimistic-concurrency pattern and needs no explicit
 * SELECT ... FOR UPDATE or advisory lock.
 */

export class ReservationError extends Error {}

export async function reserveListing(params: {
  listingId: string;
  buyerId: string;
  quantity: number;
}): Promise<{ reservation: { id: string }; expiresAt: Date }> {
  const settings = await getPaymentSettings();
  const expiresAt = new Date(Date.now() + settings.reservationTtlMinutes * 60 * 1000);

  const affected = await prisma.$executeRaw`
    UPDATE "Listing"
    SET "reservedQuantity" = "reservedQuantity" + ${params.quantity}
    WHERE id = ${params.listingId}
      AND status = 'ACTIVE'
      AND quantity - "reservedQuantity" >= ${params.quantity}
  `;

  if (affected === 0) {
    throw new ReservationError("This item is no longer available — it may already be reserved or sold.");
  }

  const reservation = await prisma.listingReservation.create({
    data: {
      listingId: params.listingId,
      buyerId: params.buyerId,
      quantity: params.quantity,
      status: "ACTIVE",
      expiresAt,
    },
  });

  return { reservation, expiresAt };
}

/** Releases a reservation back to available inventory (checkout failed/cancelled/expired). */
export async function releaseReservation(reservationId: string) {
  await prisma.$transaction(async (tx) => {
    const reservation = await tx.listingReservation.findUnique({ where: { id: reservationId } });
    if (!reservation || reservation.status !== "ACTIVE") return;

    await tx.listingReservation.update({
      where: { id: reservationId },
      data: { status: "RELEASED", releasedAt: new Date() },
    });

    await tx.listing.update({
      where: { id: reservation.listingId },
      data: { reservedQuantity: { decrement: reservation.quantity } },
    });
  });
}

/**
 * Converts a reservation into an actual inventory decrement on confirmed
 * payment — the ONLY place `Listing.quantity` is reduced and the listing
 * is marked SOLD. Idempotent: calling this twice for an already-consumed
 * reservation is a no-op, which matters because webhook delivery can
 * repeat even after our own event-id dedupe (e.g. a hand-retried event).
 */
export async function consumeReservation(orderId: string) {
  await prisma.$transaction(async (tx) => {
    const reservation = await tx.listingReservation.findUnique({ where: { orderId } });
    if (!reservation || reservation.status !== "ACTIVE") return;

    await tx.listingReservation.update({
      where: { id: reservation.id },
      data: { status: "CONSUMED" },
    });

    const listing = await tx.listing.update({
      where: { id: reservation.listingId },
      data: {
        quantity: { decrement: reservation.quantity },
        reservedQuantity: { decrement: reservation.quantity },
      },
    });

    if (listing.quantity <= 0) {
      await tx.listing.update({ where: { id: listing.id }, data: { status: "SOLD", soldAt: new Date() } });
    }
  });
}

/** Scheduled cleanup: releases any reservation past its expiry that never converted to a paid order. */
export async function sweepExpiredReservations(): Promise<number> {
  const expired = await prisma.listingReservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
    select: { id: true },
    take: 200,
  });

  for (const r of expired) {
    await releaseReservation(r.id);
  }

  return expired.length;
}
