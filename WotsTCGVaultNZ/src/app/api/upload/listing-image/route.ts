import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPresignedUpload, s3Configured, validateImageUpload } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!s3Configured()) {
    return NextResponse.json(
      { error: "Image storage is not configured yet. Add S3_* env vars to enable uploads." },
      { status: 503 }
    );
  }

  const limited = rateLimit(`upload:${session.user.id}`, 60, 60 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many uploads. Try again shortly." }, { status: 429 });
  }

  const { contentType, sizeBytes } = await req.json().catch(() => ({}));
  if (!contentType || typeof sizeBytes !== "number") {
    return NextResponse.json({ error: "Missing contentType or sizeBytes." }, { status: 400 });
  }
  const validationError = validateImageUpload(contentType, sizeBytes);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const { uploadUrl, key } = await createPresignedUpload({
    bucket: process.env.S3_BUCKET_LISTINGS!,
    contentType,
    keyPrefix: `listings/${session.user.id}`,
  });

  const publicUrl = `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET_LISTINGS}/${key}`;
  return NextResponse.json({ uploadUrl, key, publicUrl });
}
