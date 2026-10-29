// Loyalty members at the register: search by phone/name, and sign up a new one.
import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { enrollMember, LoyaltyError, searchMembers } from "@/lib/loyalty";

export async function GET(request: NextRequest) {
  try {
    await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const q = request.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json({ members: await searchMembers(q) });
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const body = (await request.json().catch(() => null)) as { name?: unknown; phone?: unknown } | null;
  if (typeof body?.name !== "string" || typeof body?.phone !== "string") {
    return NextResponse.json({ error: "Enter the customer's name and mobile number" }, { status: 400 });
  }
  try {
    const { customer, pin } = await enrollMember(
      { name: body.name, phone: body.phone },
      session.user.name ?? session.user.email ?? "Staff"
    );
    return NextResponse.json({ member: customer, pin }, { status: 201 });
  } catch (err) {
    if (err instanceof LoyaltyError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("Member sign-up failed", err);
    return NextResponse.json({ error: "Could not sign up the member" }, { status: 500 });
  }
}
