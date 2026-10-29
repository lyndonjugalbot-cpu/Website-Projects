// Voids a cash-out (puts the money back in the drawer's expected total).
import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { voidCashOut } from "@/lib/cashouts";
import { ShiftError } from "@/lib/shifts";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const body = (await request.json().catch(() => null)) as { reason?: unknown } | null;
  try {
    await voidCashOut(
      params.id,
      { id: session.user.id, name: session.user.name ?? session.user.email ?? "Staff", role: session.user.role },
      typeof body?.reason === "string" ? body.reason : ""
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ShiftError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
