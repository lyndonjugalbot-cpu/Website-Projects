// Time in / time out for the signed-in staff member.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { clockIn, clockOut, ShiftError } from "@/lib/shifts";

const bodySchema = z.object({ action: z.enum(["in", "out"]) });

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const actor = { id: session.user.id, name: session.user.name ?? session.user.email ?? "Staff" };
  try {
    const entry = parsed.data.action === "in" ? await clockIn(actor) : await clockOut(actor);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    if (err instanceof ShiftError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
