import { getServerSession } from "next-auth";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { Forbidden } from "@/components/admin/Forbidden";
import { DeviceManager } from "@/components/admin/pos/DeviceManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Approved devices" };

export default async function DevicesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !roleAtLeast(session.user.role, "OWNER")) return <Forbidden />;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Approved devices</h1>
      <p className="mt-1 max-w-2xl text-sm text-neutral-500">
        Staff can only sign in on a computer you approve here. Owner and manager accounts can still sign in anywhere.
      </p>
      <div className="mt-6">
        <DeviceManager />
      </div>
    </div>
  );
}
