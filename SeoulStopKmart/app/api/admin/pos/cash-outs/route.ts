// Cash-outs recorded at the POS: list this cashier's, and add a new one.
import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { cashOutInputSchema, createCashOut, listMyCashOuts } from "@/lib/cashouts";
import { ShiftError } from "@/lib/shifts";

export const dynamic = "force-dynamic";

export async function GET() {
  let session;
  try {
    session = await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  return NextResponse.json(await listMyCashOuts(session.user.id));
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const parsed = cashOutInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid cash out" }, { status: 400 });
  }
  try {
    const cashOut = await createCashOut({ id: session.user.id, name: session.user.name ?? session.user.email ?? "Staff" }, parsed.data);
    return NextResponse.json({ cashOut }, { status: 201 });
  } catch (err) {
    if (err instanceof ShiftError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
