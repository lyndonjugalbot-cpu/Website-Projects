import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { requireRole, UnauthorizedError } from "@/lib/authz";

// Vercel Blob storage — provisioned from the Vercel dashboard's Storage tab,
// which auto-sets BLOB_READ_WRITE_TOKEN as a project env var. See README
// "Deploying to Vercel". If that token isn't set (e.g. local dev without a
// Vercel project connected yet), this falls back to writing the local
// filesystem under public/uploads/ instead — the same
// configured-service-or-local-fallback pattern lib/paymongo.ts uses for
// payments. The local fallback only works for single-instance hosting
// (won't persist on serverless) — fine for dev, not for a real deploy.
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "products");
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
    // Downscale (never upscale) to a reasonable max size and convert to
    // WebP, regardless of the uploaded format — keeps storage and page
    // weight down without needing the admin to pre-resize photos themselves.
    const optimized = await sharp(buffer)
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`products/${filename}`, optimized, {
        access: "public",
        contentType: "image/webp",
      });
      return NextResponse.json({ imageUrl: blob.url });
    }

    await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_UPLOAD_DIR, filename), optimized);
    return NextResponse.json({ imageUrl: `/uploads/products/${filename}` });
  } catch (err) {
    console.error("Failed to process/upload image", err);
    return NextResponse.json({ error: "Could not process image" }, { status: 500 });
  }
}
