// Employee roster management — base pay is sensitive, so this whole
// resource is OWNER-only (same bar as Staff accounts).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";

export async function GET() {
  try {
    await requireRole("OWNER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const employees = await prisma.employee.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ employees });
}

const createEmployeeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  position: z.string().trim().max(100).optional().or(z.literal("")),
  basePayCentavos: z.number().int().min(1, "Base pay must be greater than 0"),
});

export async function POST(request: NextRequest) {
  try {
    await requireRole("OWNER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = createEmployeeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid employee details" }, { status: 400 });
  }

  const employee = await prisma.employee.create({
    data: {
      name: parsed.data.name,
      position: parsed.data.position || null,
      basePayCentavos: parsed.data.basePayCentavos,
    },
  });

  return NextResponse.json({ employee }, { status: 201 });
}
