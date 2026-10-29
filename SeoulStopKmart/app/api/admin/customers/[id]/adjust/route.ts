// Manager/owner correction of a member's points, always with a reason.
import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { adjustMemberPoints, LoyaltyError } from "@/lib/loyalty";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const body = (await request.json().catch(() => null)) as { points?: unknown; note?: unknown } | null;
  if (typeof body?.points !== "number" || typeof body?.note !== "string") {
    return NextResponse.json({ error: "Enter the points and a reason" }, { status: 400 });
  }
  try {
    const balance = await adjustMemberPoints(
      params.id,
      body.points,
      body.note,
      session.user.name ?? session.user.email ?? "Manager"
    );
    return NextResponse.json({ balance });
  } catch (err) {
    if (err instanceof LoyaltyError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
