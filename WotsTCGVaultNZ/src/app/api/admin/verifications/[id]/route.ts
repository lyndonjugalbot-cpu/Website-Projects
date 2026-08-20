import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-staff";
import { logAudit } from "@/lib/audit";
import { sendEmail, orderUpdateTemplate } from "@/lib/email";
import { createSignedDownload, s3Configured } from "@/lib/storage";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const guard = await requireStaff("verification.viewDocuments");
  if (guard.response) return guard.response;
  const { id } = await params;

  const submission = await prisma.identityVerification.findUnique({
    where: { id },
    include: { user: { select: { username: true, fullName: true, email: true } } },
  });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let documentUrls: { front?: string; back?: string; selfie?: string } = {};
  if (s3Configured()) {
    const bucket = process.env.S3_BUCKET_IDENTITY!;
    documentUrls = {
      front: await createSignedDownload(bucket, submission.documentFrontKey),
      back: submission.documentBackKey ? await createSignedDownload(bucket, submission.documentBackKey) : undefined,
      selfie: submission.selfieKey ? await createSignedDownload(bucket, submission.selfieKey) : undefined,
    };
  }

  await logAudit({
    actorId: guard.session!.user.id,
    action: "verification.viewDocuments",
    targetType: "IdentityVerification",
    targetId: id,
  });

  return NextResponse.json({ submission, documentUrls });
}

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "RESUBMISSION_REQUESTED"]),
  reviewerNotes: z.string().max(1000).optional(),
});

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const guard = await requireStaff("verification.review");
  if (guard.response) return guard.response;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const submission = await prisma.identityVerification.findUnique({ where: { id }, include: { user: true } });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.identityVerification.update({
    where: { id },
    data: {
      status: parsed.data.decision,
      reviewerNotes: parsed.data.reviewerNotes,
      reviewedBy: guard.session!.user.id,
      reviewedAt: new Date(),
    },
  });

  if (parsed.data.decision === "APPROVED") {
    await prisma.user.update({ where: { id: submission.userId }, data: { isIdVerified: true } });
  }

  await logAudit({
    actorId: guard.session!.user.id,
    action: `verification.${parsed.data.decision.toLowerCase()}`,
    targetType: "IdentityVerification",
    targetId: id,
    metadata: { reviewerNotes: parsed.data.reviewerNotes },
  });

  const messages: Record<string, string> = {
    APPROVED: "Your ID verification has been approved. You can now create listings!",
    REJECTED: `Your ID verification was rejected.${parsed.data.reviewerNotes ? ` Reason: ${parsed.data.reviewerNotes}` : ""}`,
    RESUBMISSION_REQUESTED: `Please resubmit your ID verification.${parsed.data.reviewerNotes ? ` ${parsed.data.reviewerNotes}` : ""}`,
  };

  await sendEmail({
    to: submission.user.email,
    subject: "Verification update — Wots TCG Vault NZ",
    html: orderUpdateTemplate(
      submission.user.fullName,
      messages[parsed.data.decision],
      `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/seller?tab=verification`
    ),
  });

  return NextResponse.json({ ok: true });
}
