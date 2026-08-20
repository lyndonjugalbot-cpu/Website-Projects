import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

/**
 * Presigned-upload pattern: the browser uploads directly to the bucket, so
 * large images/ID photos never transit the Next.js server. Works with any
 * S3-compatible provider (AWS S3, Cloudflare R2, Supabase Storage).
 * Identity documents go to a separate, non-public bucket — never the same
 * one used for listing photos.
 */
export function s3Configured() {
  return Boolean(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_ENDPOINT);
}

function getS3Client() {
  return new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

export async function createPresignedUpload(opts: {
  bucket: string;
  contentType: string;
  keyPrefix: string;
}) {
  const client = getS3Client();
  const key = `${opts.keyPrefix}/${randomUUID()}`;
  const command = new PutObjectCommand({
    Bucket: opts.bucket,
    Key: key,
    ContentType: opts.contentType,
  });
  const url = await getSignedUrl(client, command, { expiresIn: 300 });
  return { uploadUrl: url, key };
}

/** Short-lived signed read URL — used only by staff reviewing ID documents. */
export async function createSignedDownload(bucket: string, key: string) {
  const client = getS3Client();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: 120 });
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB

export function validateImageUpload(contentType: string, sizeBytes: number) {
  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    return "Only JPEG, PNG, or WEBP images are allowed.";
  }
  if (sizeBytes > MAX_IMAGE_BYTES) {
    return "Images must be smaller than 8MB.";
  }
  return null;
}
