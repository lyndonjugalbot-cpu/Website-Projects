import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Forbidden } from "@/components/admin/Forbidden";
import { ShiftPanel } from "@/components/admin/pos/ShiftPanel";
import { CashOutPanel } from "@/components/admin/pos/CashOutPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "My shift" };

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  weekday: "long",
  day: "numeric",
  month: "long",
});

export default async function ShiftPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return <Forbidden />;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-400">{dateFormatter.format(new Date())}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">My shift</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Clock in and out, count your drawer, and record money taken from the register.
      </p>

      <div className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <ShiftPanel />
        <CashOutPanel />
      </div>
    </div>
  );
}
