import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Forbidden } from "@/components/admin/Forbidden";
import { StaffManager } from "@/components/admin/StaffManager";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "OWNER") {
    return <Forbidden />;
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Staff accounts</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Owners have full access. Managers can manage products and orders. Staff can view and process orders.
      </p>

      <div className="mt-8">
        <StaffManager
          currentUserId={session.user.id}
          initialUsers={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
        />
      </div>
    </div>
  );
}
