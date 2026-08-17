import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { generateReport } from "@/lib/reports";
import type { ProductCategory, SalesChannel } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  }

  const report = await generateReport({
    startDate,
    endDate,
    channel: (searchParams.get("channel") as SalesChannel) || undefined,
    category: (searchParams.get("category") as ProductCategory) || undefined,
    paymentMethod: searchParams.get("paymentMethod") || undefined,
    orderStatus: searchParams.get("orderStatus") || undefined,
  });

  return NextResponse.json({ report });
}
