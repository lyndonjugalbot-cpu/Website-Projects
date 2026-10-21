import { getServerSession } from "next-auth";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { Forbidden } from "@/components/admin/Forbidden";
import { ReportsView } from "@/components/admin/ReportsView";
import { ExpenseManager } from "@/components/admin/ExpenseManager";
import { todayInManila } from "@/lib/timezone";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !roleAtLeast(session.user.role, "MANAGER")) {
    return <Forbidden />;
  }

  const today = todayInManila();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Reports</h1>
      <p className="mt-1 text-sm text-neutral-500">All figures use Asia/Manila (Cebu) local time.</p>

      <div className="mt-6">
        <ReportsView initialFilters={{ startDate: today, endDate: today }} />
      </div>

      <div className="mt-8">
        <ExpenseManager />
      </div>
    </div>
  );
}
