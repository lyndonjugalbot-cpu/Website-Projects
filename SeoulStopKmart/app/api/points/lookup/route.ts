// Public balance check for the website's /points page: phone number + PIN.
import { NextRequest, NextResponse } from "next/server";
import { lookupPoints } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { phone?: unknown; pin?: unknown } | null;
  if (typeof body?.phone !== "string" || typeof body?.pin !== "string") {
    return NextResponse.json({ error: "Enter your mobile number and PIN" }, { status: 400 });
  }
  const result = await lookupPoints(body.phone, body.pin.trim());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });
  return NextResponse.json(result);
}
