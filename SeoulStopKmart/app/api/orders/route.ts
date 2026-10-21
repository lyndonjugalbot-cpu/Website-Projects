// Public endpoint hit by the checkout form (app/checkout/page.tsx) when a
// customer submits their cart + delivery details. Creates a PENDING order;
// payment happens afterward on the /checkout/[orderId]/pay page.
import { NextRequest, NextResponse } from "next/server";
import { checkoutInputSchema, createOrderFromCart, OrderCreationError } from "@/lib/orders";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Re-validates everything server-side — the client-side form validation
  // is just for UX, this is what's actually enforced.
  const parsed = checkoutInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid checkout details" },
      { status: 400 }
    );
  }

  try {
    const order = await createOrderFromCart(parsed.data);
    return NextResponse.json({ orderId: order.id, totalCentavos: order.totalCentavos });
  } catch (err) {
    // OrderCreationError = a normal, expected failure (item out of stock,
    // no longer available) — shown to the customer as-is. Anything else is
    // unexpected and logged for debugging instead of exposed.
    if (err instanceof OrderCreationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Failed to create order", err);
    return NextResponse.json({ error: "Could not create order" }, { status: 500 });
  }
}
