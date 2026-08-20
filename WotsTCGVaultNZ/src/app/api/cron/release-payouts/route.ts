import { NextRequest, NextResponse } from "next/server";
import { sweepInspectionPeriods, sweepStaleDeliveries, releaseEligiblePayouts } from "@/lib/payouts";
import { sweepExpiredReservations } from "@/lib/reservations";

/**
 * Scheduled job entry point — wire this to Vercel Cron (or any external
 * scheduler) hitting this URL with `Authorization: Bearer $CRON_SECRET`
 * every few minutes. This is what actually moves money (Stripe Transfers),
 * so it is NOT run inline on page loads like the cheaper DB-only sweeps —
 * see docs/DEPLOYMENT.md for the Vercel Cron config and
 * docs/PAYMENTS.md for local testing via `curl`.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  const authHeader = req.headers.get("authorization");
  const querySecret = new URL(req.url).searchParams.get("secret");
  if (authHeader !== `Bearer ${expected}` && querySecret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const releasedReservations = await sweepExpiredReservations();
  const promotedToEligible = await sweepInspectionPeriods();
  const flaggedStale = await sweepStaleDeliveries();
  const { released, skipped, failed } = await releaseEligiblePayouts();

  return NextResponse.json({
    releasedReservations,
    promotedToEligible,
    flaggedStale,
    payoutsReleased: released,
    payoutsSkippedForManualApproval: skipped,
    payoutsFailed: failed,
  });
}

// Convenience for platforms that only support GET-based cron pings.
export async function GET(req: NextRequest) {
  return POST(req);
}
