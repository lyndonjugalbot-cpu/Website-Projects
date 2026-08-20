import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { submitSellerResponse, DisputeError } from "@/lib/disputes";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({ response: z.string().min(10).max(2000) });

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    await submitSellerResponse({ disputeId: id, sellerId: session.user.id, response: parsed.data.response });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DisputeError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
