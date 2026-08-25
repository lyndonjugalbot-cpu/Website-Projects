import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";

const patchSchema = z.object({
  position: z.string().trim().max(100).optional().or(z.literal("")),
  dailyRateCentavos: z.number().int().min(1, "Daily rate must be greater than 0").optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update" }, { status: 400 });
  }

  const employee = await prisma.employee.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.position !== undefined ? { position: parsed.data.position || null } : {}),
      ...(parsed.data.dailyRateCentavos !== undefined ? { dailyRateCentavos: parsed.data.dailyRateCentavos } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
    },
  });

  return NextResponse.json({ employee });
}
