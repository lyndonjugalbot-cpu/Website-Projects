import { getServerSession } from "next-auth";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { Forbidden } from "@/components/admin/Forbidden";
import { TimesheetManager } from "@/components/admin/TimesheetManager";
import { todayInManila } from "@/lib/timezone";

export const dynamic = "force-dynamic";
export const metadata = { title: "Timesheets" };

export default async function TimesheetsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !roleAtLeast(session.user.role, "MANAGER")) return <Forbidden />;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Timesheets</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Everyone&apos;s time in / time out from the POS, with hours worked out automatically. Fix forgotten time-outs here — the Payroll page
        can pull these hours straight into a payslip.
      </p>
      <div className="mt-6">
        <TimesheetManager today={todayInManila()} />
      </div>
    </div>
  );
}
