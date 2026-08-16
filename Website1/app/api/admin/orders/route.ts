import { NextRequest, NextResponse } from "next/server";
import { listOrders } from "@/lib/orders";
import { requireRole, UnauthorizedError } from "@/lib/authz";

export async function GET(request: NextRequest) {
  try {
    await requireRole("STAFF");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const { searchParams } = request.nextUrl;
  const orders = await listOrders({
    search: searchParams.get("search") ?? undefined,
    orderStatus: searchParams.get("orderStatus") ?? undefined,
    paymentStatus: searchParams.get("paymentStatus") ?? undefined,
  });

  return NextResponse.json({ orders });
}
