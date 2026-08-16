import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";

const patchSchema = z.object({
  role: z.enum(["OWNER", "MANAGER", "STAFF"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(200).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireRole("OWNER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (params.id === session.user.id && (parsed.data.isActive === false || parsed.data.role === "STAFF" || parsed.data.role === "MANAGER")) {
    return NextResponse.json({ error: "You can't demote or deactivate your own account" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 12) : undefined;

  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      ...(passwordHash ? { passwordHash } : {}),
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });

  return NextResponse.json({ user });
}
