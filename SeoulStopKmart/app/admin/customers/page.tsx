import { getServerSession } from "next-auth";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Forbidden } from "@/components/admin/Forbidden";
import { CustomerManager } from "@/components/admin/CustomerManager";
import { normalizePhone } from "@/lib/loyalty-math";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rewards members" };

export default async function CustomersPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !roleAtLeast(session.user.role, "MANAGER")) return <Forbidden />;

  const q = searchParams.q?.trim() ?? "";
  const phone = q ? normalizePhone(q) : null;
  const [customers, total, pointsOutstanding] = await Promise.all([
    prisma.customer.findMany({
      where: q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, ...(phone ? [{ phone }] : []), { phone: { contains: q.replace(/[^\d]/g, "").replace(/^0/, "") || "-" } }] }
        : {},
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.customer.count(),
    prisma.customer.aggregate({ _sum: { points: true } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Rewards members</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {total} member{total === 1 ? "" : "s"} · {(pointsOutstanding._sum.points ?? 0).toLocaleString()} points outstanding. Members are
        signed up at the register; customers check their points on the website with their mobile number and PIN.
      </p>

      <CustomerManager
        query={q}
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          points: c.points,
          lifetimePoints: c.lifetimePoints,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
