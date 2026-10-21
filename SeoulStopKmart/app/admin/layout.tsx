import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { getBillAlert } from "@/lib/bills-server";
import { isPosHost } from "@/lib/pos-host";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  // Middleware already gates every /admin route except /admin/login, but
  // /admin/login itself renders through this same layout — skip the shell
  // (nav, sign-out button) when there's no session yet.
  if (!session?.user) {
    return <div className="min-h-screen bg-neutral-50">{children}</div>;
  }

  const posOnly = isPosHost(headers().get("host"));
  // Bill reminders are for the people who pay the bills, and not shown on
  // the cashiers' POS-only link.
  const billAlert = !posOnly && roleAtLeast(session.user.role, "MANAGER") ? await getBillAlert() : null;

  return (
    <AdminShell
      user={{ name: session.user.name ?? "", email: session.user.email ?? "", role: session.user.role }}
      posOnly={posOnly}
      billAlert={billAlert}
    >
      {children}
    </AdminShell>
  );
}
