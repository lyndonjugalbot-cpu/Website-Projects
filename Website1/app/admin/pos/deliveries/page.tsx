import { getServerSession } from "next-auth";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { Forbidden } from "@/components/admin/Forbidden";
import { DeliveryTracker } from "@/components/admin/pos/DeliveryTracker";
import { todayInManila } from "@/lib/timezone";

export const dynamic = "force-dynamic";
export const metadata = { title: "Delivery receipts" };

export default async function DeliveriesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return <Forbidden />;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Delivery receipts</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Log each supplier delivery receipt as it arrives — name, amount and date. These are stock purchases, so they&apos;re tracked
        here but not subtracted from profit a second time (each item&apos;s cost is already counted when it sells).
      </p>
      <div className="mt-6">
        <DeliveryTracker today={todayInManila()} canManage={roleAtLeast(session.user.role, "MANAGER")} />
      </div>
    </div>
  );
}
