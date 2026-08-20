import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { resolveDispute, DisputeError } from "@/lib/disputes";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  outcome: z.enum(["RESOLVED_BUYER", "RESOLVED_SELLER", "PARTIAL_REFUND", "CLOSED"]),
  resolutionNotes: z.string().max(1000).optional(),
  internalNotes: z.string().max(2000).optional(),
  refundCents: z.number().int().min(0).optional(),
});

/**
 * Admin dispute resolution. Refunds (RESOLVED_BUYER / PARTIAL_REFUND with
 * refundCents) go through lib/refunds.ts internally, which safely handles
 * reversing a Transfer if the seller was already paid out — see
 * lib/disputes.ts resolveDispute.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const guard = await requireStaff("dispute.manage");
  if (guard.response) return guard.response;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    await resolveDispute({
      disputeId: id,
      resolvedBy: guard.session!.user.id,
      outcome: parsed.data.outcome,
      resolutionNotes: parsed.data.resolutionNotes,
      internalNotes: parsed.data.internalNotes,
      refundCents: parsed.data.refundCents,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DisputeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
