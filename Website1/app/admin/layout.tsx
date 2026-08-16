import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  // Middleware already gates every /admin route except /admin/login, but
  // /admin/login itself renders through this same layout — skip the shell
  // (nav, sign-out button) when there's no session yet.
  if (!session?.user) {
    return <div className="min-h-screen bg-neutral-50">{children}</div>;
  }

  return (
    <AdminShell user={{ name: session.user.name ?? "", email: session.user.email ?? "", role: session.user.role }}>
      {children}
    </AdminShell>
  );
}
