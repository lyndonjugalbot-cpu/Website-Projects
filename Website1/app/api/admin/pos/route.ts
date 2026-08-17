import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { createPosSale, posSaleInputSchema, PosSaleError } from "@/lib/pos";
import { prisma } from "@/lib/prisma";
import { effectivePrice } from "@/lib/types";
import { STAFF_MAX_DISCOUNT_PERCENT } from "@/lib/store-config";

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = posSaleInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid sale" }, { status: 400 });
  }

  // Discount approval: Staff can self-approve up to STAFF_MAX_DISCOUNT_PERCENT
  // of the subtotal; Manager/Owner have no cap. Enforced server-side — the
  // POS UI also disables the field past the cap, but this is the real gate.
  if (parsed.data.discountCentavos > 0 && session.user.role === "STAFF") {
    const productIds = parsed.data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productById = new Map(products.map((p) => [p.id, p]));
    let subtotal = 0;
    for (const item of parsed.data.items) {
      const product = productById.get(item.productId);
      if (product) subtotal += effectivePrice(product) * item.quantity;
    }
    const maxAllowed = Math.floor(subtotal * (STAFF_MAX_DISCOUNT_PERCENT / 100));
    if (parsed.data.discountCentavos > maxAllowed) {
      return NextResponse.json(
        { error: `Staff can discount up to ${STAFF_MAX_DISCOUNT_PERCENT}% (₱${(maxAllowed / 100).toFixed(2)}) — ask a manager for more.` },
        { status: 403 }
      );
    }
  }

  try {
    const order = await createPosSale(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.email ?? "Staff",
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    if (err instanceof PosSaleError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("POS sale failed", err);
    return NextResponse.json({ error: "Could not complete sale" }, { status: 500 });
  }
}
