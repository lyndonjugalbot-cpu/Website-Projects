import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { openBuyerDispute, DisputeError } from "@/lib/disputes";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  orderId: z.string().min(1),
  reason: z.enum([
    "NOT_AS_DESCRIBED",
    "SUSPECTED_COUNTERFEIT",
    "DAMAGED",
    "MISSING_OR_INCORRECT_ITEM",
    "NOT_RECEIVED",
    "OTHER",
  ]),
  description: z.string().min(10).max(2000),
});

/** Buyer opens an in-app dispute during the inspection period (or while shipped/in transit — see lib/disputes.ts). */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = rateLimit(`dispute:${session.user.id}`, 5, 60 * 60 * 1000);
  if (!limited.success) return NextResponse.json({ error: "Too many disputes filed recently." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const dispute = await openBuyerDispute({
      orderId: parsed.data.orderId,
      filedById: session.user.id,
      reason: parsed.data.reason,
      description: parsed.data.description,
    });
    return NextResponse.json({ ok: true, disputeId: dispute.id });
  } catch (err) {
    if (err instanceof DisputeError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
