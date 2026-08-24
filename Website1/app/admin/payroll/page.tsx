import { getServerSession } from "next-auth";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Forbidden } from "@/components/admin/Forbidden";
import { PayrollManager } from "@/components/admin/PayrollManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payroll" };

export default async function PayrollPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !roleAtLeast(session.user.role, "MANAGER")) {
    return <Forbidden />;
  }

  const [employees, payslips] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.payslip.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Payroll</h1>
      <p className="mt-1 text-sm text-neutral-500">Manage employees&apos; base pay and generate payslips.</p>

      <div className="mt-8">
        <PayrollManager
          initialEmployees={employees}
          initialPayslips={payslips.map((p) => ({
            id: p.id,
            employeeName: p.employeeName,
            periodStart: p.periodStart.toISOString(),
            periodEnd: p.periodEnd.toISOString(),
            netPayCentavos: p.netPayCentavos,
            createdAt: p.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
