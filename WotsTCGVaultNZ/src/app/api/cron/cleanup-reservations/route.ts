import { NextRequest, NextResponse } from "next/server";
import { sweepExpiredReservations } from "@/lib/reservations";

/**
 * Lightweight, frequent cron target (recommended every 1-2 minutes) — the
 * inline lazy sweep in /api/orders also runs this, but a dedicated
 * scheduled job guarantees expired reservations are released even if no
 * one is actively browsing the site to trigger the lazy sweep.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  const authHeader = req.headers.get("authorization");
  const querySecret = new URL(req.url).searchParams.get("secret");
  if (authHeader !== `Bearer ${expected}` && querySecret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const released = await sweepExpiredReservations();
  return NextResponse.json({ released });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
