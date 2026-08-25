import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Forbidden } from "@/components/admin/Forbidden";
import { formatCentavosAsPHP } from "@/lib/money";
import { STORE_NAME } from "@/lib/store-config";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

type Adjustment = { label: string; amountCentavos: number };

export default async function PayslipPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !roleAtLeast(session.user.role, "MANAGER")) {
    return <Forbidden />;
  }

  const payslip = await prisma.payslip.findUnique({ where: { id: params.id } });
  if (!payslip) notFound();

  const adjustments = Array.isArray(payslip.adjustments) ? (payslip.adjustments as unknown as Adjustment[]) : [];
  // Split into Earnings (bonuses/allowances/holiday pay) and Deductions
  // (absences/cash advances/etc.) — the API stores both signs in one list,
  // a payslip reads clearer with them in separate columns.
  const earningLines = adjustments.filter((a) => a.amountCentavos >= 0);
  const deductionLines = adjustments.filter((a) => a.amountCentavos < 0);
  const grossPayCentavos = payslip.regularPayCentavos + earningLines.reduce((sum, a) => sum + a.amountCentavos, 0);
  const totalDeductionsCentavos = deductionLines.reduce((sum, a) => sum + Math.abs(a.amountCentavos), 0);

  const dateFormatter = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/payroll" className="text-sm text-neutral-500 hover:text-neutral-800 print:hidden">
        &larr; Back to Payroll
      </Link>

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-8 print:rounded-none print:border-none print:p-0">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-6">
          <div>
            <p className="text-xl font-semibold text-neutral-900">{STORE_NAME}</p>
            <p className="mt-0.5 text-sm text-neutral-500">Payslip #{payslip.id.slice(0, 10).toUpperCase()}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Pay period</p>
            <p className="mt-0.5 text-sm font-medium text-neutral-900">
              {dateFormatter.format(payslip.periodStart)} – {dateFormatter.format(payslip.periodEnd)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-neutral-200 py-6 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Employee</p>
            <p className="mt-0.5 text-sm font-medium text-neutral-900">{payslip.employeeName}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Position</p>
            <p className="mt-0.5 text-sm font-medium text-neutral-900">{payslip.position ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Daily rate</p>
            <p className="mt-0.5 text-sm font-medium text-neutral-900">{formatCentavosAsPHP(payslip.dailyRateCentavos)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Hours worked</p>
            <p className="mt-0.5 text-sm font-medium text-neutral-900">{payslip.hoursWorked}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Earnings</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between text-neutral-700">
                <span>Regular pay</span>
                <span>{formatCentavosAsPHP(payslip.regularPayCentavos)}</span>
              </div>
              {earningLines.map((a, i) => (
                <div key={i} className="flex justify-between text-neutral-700">
                  <span>{a.label}</span>
                  <span>{formatCentavosAsPHP(a.amountCentavos)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-neutral-200 pt-2 font-medium text-neutral-900">
                <span>Gross pay</span>
                <span>{formatCentavosAsPHP(grossPayCentavos)}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Deductions</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              {deductionLines.length === 0 ? (
                <p className="text-neutral-400">None</p>
              ) : (
                deductionLines.map((a, i) => (
                  <div key={i} className="flex justify-between text-neutral-700">
                    <span>{a.label}</span>
                    <span>{formatCentavosAsPHP(Math.abs(a.amountCentavos))}</span>
                  </div>
                ))
              )}
              <div className="flex justify-between border-t border-neutral-200 pt-2 font-medium text-neutral-900">
                <span>Total deductions</span>
                <span>{formatCentavosAsPHP(totalDeductionsCentavos)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-neutral-900 px-6 py-4">
          <span className="text-sm font-medium uppercase tracking-wide text-neutral-300">Net pay</span>
          <span className="text-2xl font-bold text-white">{formatCentavosAsPHP(payslip.netPayCentavos)}</span>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8 text-xs text-neutral-500 print:mt-16">
          <div className="border-t border-neutral-300 pt-2">Employee signature</div>
          <div className="border-t border-neutral-300 pt-2">
            {payslip.generatedByName ? `Prepared by ${payslip.generatedByName}` : "Prepared by"}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <PrintButton label="Print payslip" />
      </div>
    </div>
  );
}
