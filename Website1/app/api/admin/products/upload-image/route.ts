import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { requireRole, UnauthorizedError } from "@/lib/authz";

// Local filesystem storage under public/uploads/products/ — no cloud
// storage bucket is configured for this project (see README "Product
// image storage"). This works for local dev and single-instance hosting;
// it will NOT persist across deploys/instances on serverless platforms
// like Vercel, the same caveat the README already documents for SQLite.
// Swap this for an S3/Cloudinary/Vercel Blob upload before deploying to
// serverless infrastructure.
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "products");
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  try {
    await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, or WEBP images are allowed" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 8MB or smaller" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}.webp`;

  try {
    const optimized = await sharp(buffer)
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, filename), optimized);
  } catch (err) {
    console.error("Failed to process uploaded image", err);
    return NextResponse.json({ error: "Could not process image" }, { status: 500 });
  }

  return NextResponse.json({ imageUrl: `/uploads/products/${filename}` });
}
