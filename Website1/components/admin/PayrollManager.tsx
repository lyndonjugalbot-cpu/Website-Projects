"use client";

import { useState } from "react";
import { EmployeeManager, type Employee } from "@/components/admin/EmployeeManager";
import { PayslipGenerator } from "@/components/admin/PayslipGenerator";

type Payslip = {
  id: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  netPayCentavos: number;
  createdAt: string;
};

export function PayrollManager({
  initialEmployees,
  initialPayslips,
}: {
  initialEmployees: Employee[];
  initialPayslips: Payslip[];
}) {
  const [employees, setEmployees] = useState(initialEmployees);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="text-lg font-medium text-neutral-900">Employees</h2>
        <p className="mt-1 text-sm text-neutral-500">Set each employee&apos;s daily rate — payslips compute pay from hours worked plus any holiday bonuses.</p>
        <div className="mt-4">
          <EmployeeManager initialEmployees={initialEmployees} onChange={setEmployees} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-neutral-900">Payslips</h2>
        <div className="mt-4">
          <PayslipGenerator employees={employees} initialPayslips={initialPayslips} />
        </div>
      </section>
    </div>
  );
}
