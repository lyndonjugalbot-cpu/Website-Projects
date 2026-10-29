// Owner-only: revoke an approved computer. Staff sessions on it end right away.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole("OWNER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const result = await prisma.posDevice.updateMany({
    where: { id: params.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) return NextResponse.json({ error: "Device not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
