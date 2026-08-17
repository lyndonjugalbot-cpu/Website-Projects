import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { voidPosSale, PosSaleError, VoidNotAllowedError } from "@/lib/pos";

const bodySchema = z.object({ reason: z.string().trim().min(1, "A reason is required") });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  try {
    await voidPosSale(
      params.id,
      { id: session.user.id, name: session.user.name ?? session.user.email ?? "Staff", role: session.user.role },
      parsed.data.reason
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof VoidNotAllowedError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof PosSaleError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("Void POS sale failed", err);
    return NextResponse.json({ error: "Could not void sale" }, { status: 500 });
  }
}
