import { NextRequest, NextResponse } from "next/server";
import { checkoutInputSchema, createOrderFromCart, OrderCreationError } from "@/lib/orders";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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
    if (err instanceof OrderCreationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Failed to create order", err);
    return NextResponse.json({ error: "Could not create order" }, { status: 500 });
  }
}
