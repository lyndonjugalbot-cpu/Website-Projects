// Start-of-shift and end-of-shift cash + GCash counts for the signed-in cashier.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { closeCashSession, openCashSession, ShiftError } from "@/lib/shifts";

const amount = z.number().int().min(0, "Amounts can't be negative").max(100_000_000);

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open"), cashCentavos: amount, gcashCentavos: amount }),
  z.object({
    action: z.literal("close"),
    cashCentavos: amount,
    gcashCentavos: amount,
    note: z.string().trim().max(500).optional(),
  }),
]);

export async function POST(request: NextRequest) {
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

  const actor = { id: session.user.id, name: session.user.name ?? session.user.email ?? "Staff" };
  try {
    const cashSession =
      parsed.data.action === "open"
        ? await openCashSession(actor, parsed.data.cashCentavos, parsed.data.gcashCentavos)
        : await closeCashSession(actor, parsed.data.cashCentavos, parsed.data.gcashCentavos, parsed.data.note);
    return NextResponse.json({ cashSession }, { status: 201 });
  } catch (err) {
    if (err instanceof ShiftError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
