// Device lock: staff accounts can only sign in from store computers the owner
// has approved. Approval puts a random secret in an httpOnly cookie on that
// browser; the database keeps only its hash. Server-side only.
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export const DEVICE_COOKIE = "ssk_device";
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5; // 5 years

export function hashDeviceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newDeviceToken() {
  return randomBytes(32).toString("base64url");
}

/** Reads one cookie out of a raw `Cookie:` header. */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq > -1 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

/** The active (not revoked) device this cookie token belongs to, if any. */
export async function findActiveDevice(token: string | null | undefined) {
  if (!token) return null;
  const device = await prisma.posDevice.findUnique({ where: { tokenHash: hashDeviceToken(token) } });
  return device && !device.revokedAt ? device : null;
}

/**
 * The lock switches on once the owner approves the first device, and stays on
 * even if every device is later revoked — so removing a device never opens the
 * door to everyone. Before that, staff can sign in anywhere (nothing to lock to).
 */
export async function deviceLockActive() {
  return (await prisma.posDevice.count()) > 0;
}
