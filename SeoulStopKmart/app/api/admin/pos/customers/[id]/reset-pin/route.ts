// Gives a member a new PIN when they've forgotten theirs.
import { NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { LoyaltyError, resetMemberPin } from "@/lib/loyalty";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  try {
    return NextResponse.json({ pin: await resetMemberPin(params.id) });
  } catch (err) {
    if (err instanceof LoyaltyError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
