import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCentavosAsPHP } from "@/lib/money";
import { todayInManila, manilaDayStartUtc, manilaDayEndUtc } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const today = todayInManila();
  const todayStart = manilaDayStartUtc(today);
  const todayEnd = manilaDayEndUtc(today);

  const [todaysOrders, pendingOrders, lowStock, recentOrders] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: todayStart, lt: todayEnd }, paymentStatus: "PAID" } }),
    prisma.order.count({ where: { orderStatus: "PENDING" } }),
    prisma.product.findMany({ where: { status: { not: "INACTIVE" } } }).then((ps) => ps.filter((p) => p.stock <= p.lowStockThreshold)),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const todaysRevenue = todaysOrders.reduce((sum, o) => sum + o.totalCentavos, 0);
  const todaysPos = todaysOrders.filter((o) => o.channel === "POS").length;
  const todaysOnline = todaysOrders.filter((o) => o.channel === "ONLINE").length;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Dashboard</h1>
      <p className="mt-1 text-sm text-neutral-500">Welcome back, {session.user.name || session.user.email}.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's sales" value={formatCentavosAsPHP(todaysRevenue)} sub={`${todaysOrders.length} transactions`} />
        <StatCard label="POS sales today" value={String(todaysPos)} sub="in-store" />
        <StatCard label="Online sales today" value={String(todaysOnline)} sub="storefront" />
        <StatCard label="Pending orders" value={String(pendingOrders)} sub="need confirmation" href="/admin/orders?orderStatus=PENDING" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-900">Low stock</h2>
            {roleAtLeast(session.user.role, "MANAGER") && (
              <Link href="/admin/inventory" className="text-sm font-medium text-brand-red hover:underline">View all</Link>
            )}
          </div>
          {lowStock.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">Nothing low on stock right now.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {lowStock.slice(0, 6).map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span className="text-neutral-700">{p.name}</span>
                  <span className={p.stock === 0 ? "font-medium text-red-600" : "font-medium text-amber-600"}>
                    {p.stock} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-900">Recent orders</h2>
            <Link href="/admin/orders" className="text-sm font-medium text-brand-red hover:underline">View all</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">No orders yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {recentOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex justify-between text-sm hover:text-brand-red">
                    <span className="text-neutral-700">
                      {o.channel === "POS" ? "In-store" : "Online"} — {o.customerName || "Walk-in"}
                    </span>
                    <span className="font-medium text-neutral-900">{formatCentavosAsPHP(o.totalCentavos)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/admin/pos" className="rounded-full bg-brand-red px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red-dark">
          Open POS
        </Link>
        {roleAtLeast(session.user.role, "MANAGER") && (
          <Link href="/admin/reports" className="rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-400">
            View reports
          </Link>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, href }: { label: string; value: string; sub: string; href?: string }) {
  const content = (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-neutral-900">{value}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
