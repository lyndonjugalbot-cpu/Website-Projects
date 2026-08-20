import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { issueRefund, RefundError } from "@/lib/refunds";
import { z } from "zod";

const schema = z.object({
  orderId: z.string().min(1),
  amountCents: z.number().int().min(1),
  reason: z.string().min(3).max(500),
  type: z.enum(["FULL", "PARTIAL", "SHIPPING_ONLY"]),
});

/**
 * Refunds are always staff-initiated through this endpoint (not
 * self-service for buyers or sellers) — see docs/PAYMENTS.md for why
 * automated buyer-triggered refunds are riskier than a light-touch admin
 * approval step for a fraud-prone flow like marketplace payments.
 */
export async function POST(req: NextRequest) {
  const guard = await requireStaff("refund.approve");
  if (guard.response) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await issueRefund({ ...parsed.data, processedBy: guard.session!.user.id });
    return NextResponse.json({ ok: true, refundId: result.refundId });
  } catch (err) {
    if (err instanceof RefundError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
