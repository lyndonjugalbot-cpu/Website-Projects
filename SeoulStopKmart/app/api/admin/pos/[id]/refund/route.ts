// Refunds some or all items of a POS sale (the "Refund items" panel on the
// receipt page). Manager/Owner only — the rules live in lib/pos.ts,
// refundPosSale(); this route is just the HTTP wrapper around it.
import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { refundInputSchema, refundPosSale, PosSaleError, VoidNotAllowedError } from "@/lib/pos";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = refundInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid refund" }, { status: 400 });
  }

  try {
    const refund = await refundPosSale(
      params.id,
      { id: session.user.id, name: session.user.name ?? session.user.email ?? "Manager", role: session.user.role },
      parsed.data
    );
    return NextResponse.json({ refund }, { status: 201 });
  } catch (err) {
    if (err instanceof VoidNotAllowedError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof PosSaleError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("POS refund failed", err);
    return NextResponse.json({ error: "Could not process refund" }, { status: 500 });
  }
}
