import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { releasePayoutManually } from "@/lib/payouts";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Manual payout release — restricted to SUPER_ADMIN only (via the
 * "payout.release" capability, which only the wildcard role satisfies).
 * This is the highest-blast-radius admin action in the system (it moves
 * real money to a seller's bank), so it deliberately has a narrower
 * permission than dispute/refund handling.
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const guard = await requireStaff("payout.release");
  if (guard.response) return guard.response;
  const { id } = await params;

  try {
    await releasePayoutManually(id, guard.session!.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not release payout.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
