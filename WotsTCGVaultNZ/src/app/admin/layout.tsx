import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaff } from "@/lib/rbac";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import type { Role } from "@prisma/client";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isStaff(session.user.role as Role)) {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-display font-bold">Admin Panel</h1>
        <span className="text-xs text-muted-2">Signed in as {session.user.role}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        <AdminSidebar />
        <div>{children}</div>
      </div>
    </div>
  );
}
