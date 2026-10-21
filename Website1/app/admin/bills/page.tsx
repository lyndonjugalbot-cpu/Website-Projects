import { getServerSession } from "next-auth";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { Forbidden } from "@/components/admin/Forbidden";
import { BillsManager } from "@/components/admin/BillsManager";
import { todayInManila } from "@/lib/timezone";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bills" };

export default async function BillsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !roleAtLeast(session.user.role, "MANAGER")) return <Forbidden />;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Bills</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Track rent, utilities and loan payments. Each bill is plotted on its due date and flagged before it&apos;s due. Paid bills
        count as operating expenses in your profit.
      </p>
      <div className="mt-6">
        <BillsManager today={todayInManila()} />
      </div>
    </div>
  );
}
