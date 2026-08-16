import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrderById, markOrderFailed, markOrderPaid } from "@/lib/orders";

const bodySchema = z.object({
  orderId: z.string().min(1),
  outcome: z.enum(["success", "failed"]),
});

/**
 * Simulates what a real PayMongo webhook would do, for orders paid through
 * the MOCK flow only. Guarded by isMockPayment so this can never be used to
 * mark a real (non-mock) order as paid for free.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const order = await getOrderById(parsed.data.orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!order.isMockPayment) {
    return NextResponse.json({ error: "This order is not using the mock payment flow" }, { status: 400 });
  }

  if (parsed.data.outcome === "success") {
    await markOrderPaid(order.id);
  } else {
    await markOrderFailed(order.id);
  }

  return NextResponse.json({ ok: true });
}
