import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Toggles whether the linked Facebook profile URL is shown publicly.
 * Linking Facebook (via OAuth) never implies consent to publish it — this
 * is a separate, explicit opt-in per the "no exposed private Facebook data
 * without consent" requirement.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { publicConsent } = await req.json().catch(() => ({ publicConsent: null }));
  if (typeof publicConsent !== "boolean") {
    return NextResponse.json({ error: "publicConsent must be a boolean." }, { status: 400 });
  }

  const connection = await prisma.facebookConnection.findUnique({ where: { userId: session.user.id } });
  if (!connection) {
    return NextResponse.json({ error: "No Facebook account connected." }, { status: 404 });
  }

  await prisma.facebookConnection.update({
    where: { userId: session.user.id },
    data: { publicConsent, consentUpdatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
