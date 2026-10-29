// Owner-only: list the approved store computers, and approve the computer
// making this request (sets its device-key cookie).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_MAX_AGE,
  findActiveDevice,
  hashDeviceToken,
  newDeviceToken,
  readCookie,
} from "@/lib/pos-device";

export const dynamic = "force-dynamic";

function authError(err: unknown) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
  throw err;
}

export async function GET(req: Request) {
  try {
    await requireRole("OWNER");
  } catch (err) {
    return authError(err);
  }
  const [devices, current] = await Promise.all([
    prisma.posDevice.findMany({ orderBy: { createdAt: "desc" } }),
    findActiveDevice(readCookie(req.headers.get("cookie"), DEVICE_COOKIE)),
  ]);
  return NextResponse.json({
    currentDeviceId: current?.id ?? null,
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name,
      approvedByName: d.approvedByName,
      createdAt: d.createdAt,
      lastSeenAt: d.lastSeenAt,
      revokedAt: d.revokedAt,
    })),
  });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireRole("OWNER");
  } catch (err) {
    return authError(err);
  }
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return NextResponse.json({ error: "Give this computer a name, e.g. Front counter" }, { status: 400 });

  const token = newDeviceToken();
  const device = await prisma.posDevice.create({
    data: {
      name,
      tokenHash: hashDeviceToken(token),
      approvedByName: session.user.name || session.user.email || "Owner",
    },
  });

  const res = NextResponse.json({ id: device.id });
  res.cookies.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  });
  return res;
}
