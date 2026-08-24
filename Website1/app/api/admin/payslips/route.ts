// Payslip generation — computes net pay from an employee's base pay plus
// admin-entered adjustments (bonuses/allowances as positive amounts,
// deductions/absences/cash advances as negative amounts) and snapshots the
// employee's identity/base pay so history stays accurate if the employee
// record is later edited.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";

export async function GET(request: NextRequest) {
  try {
    await requireRole("OWNER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const employeeId = request.nextUrl.searchParams.get("employeeId");

  const payslips = await prisma.payslip.findMany({
    where: employeeId ? { employeeId } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ payslips });
}

const adjustmentSchema = z.object({
  label: z.string().trim().min(1, "Adjustment label is required").max(100),
  amountCentavos: z.number().int(),
});

const generatePayslipSchema = z
  .object({
    employeeId: z.string().min(1),
    periodStart: z.string().min(1),
    periodEnd: z.string().min(1),
    adjustments: z.array(adjustmentSchema).max(20).default([]),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: "Period end must be on or after period start",
    path: ["periodEnd"],
  });

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole("OWNER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = generatePayslipSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payslip request" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: parsed.data.employeeId } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const adjustmentsTotal = parsed.data.adjustments.reduce((sum, a) => sum + a.amountCentavos, 0);
  const netPayCentavos = employee.basePayCentavos + adjustmentsTotal;
  if (netPayCentavos < 0) {
    return NextResponse.json({ error: "Net pay cannot be negative — reduce the deductions" }, { status: 400 });
  }

  const payslip = await prisma.payslip.create({
    data: {
      employeeId: employee.id,
      employeeName: employee.name,
      position: employee.position,
      periodStart: new Date(`${parsed.data.periodStart}T00:00:00+08:00`),
      periodEnd: new Date(`${parsed.data.periodEnd}T00:00:00+08:00`),
      basePayCentavos: employee.basePayCentavos,
      adjustments: parsed.data.adjustments,
      netPayCentavos,
      generatedByName: session.user.name ?? session.user.email ?? "Owner",
    },
  });

  return NextResponse.json({ payslip }, { status: 201 });
}
