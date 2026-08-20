import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

const submitSchema = z.object({
  documentType: z.enum(["drivers_license", "passport", "nz_id"]),
  documentFrontKey: z.string().min(1),
  documentBackKey: z.string().optional(),
  selfieKey: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const pending = await prisma.identityVerification.findFirst({
    where: { userId: session.user.id, status: { in: ["PENDING", "RESUBMISSION_REQUESTED"] } },
  });
  if (pending && pending.status === "PENDING") {
    return NextResponse.json({ error: "You already have a submission under review." }, { status: 409 });
  }

  const submission = await prisma.identityVerification.create({
    data: {
      userId: session.user.id,
      status: "PENDING",
      documentType: parsed.data.documentType,
      documentFrontKey: parsed.data.documentFrontKey,
      documentBackKey: parsed.data.documentBackKey,
      selfieKey: parsed.data.selfieKey,
      // Retained only as long as needed for compliance review; purged after
      // approval/rejection per docs/LEGAL.md's retention policy.
      purgeAfter: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "verification.submit",
    targetType: "IdentityVerification",
    targetId: submission.id,
  });

  return NextResponse.json({ ok: true, submissionId: submission.id });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const submissions = await prisma.identityVerification.findMany({
    where: { userId: session.user.id },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      status: true,
      documentType: true,
      reviewerNotes: true,
      submittedAt: true,
      reviewedAt: true,
    },
  });

  return NextResponse.json({ submissions });
}
