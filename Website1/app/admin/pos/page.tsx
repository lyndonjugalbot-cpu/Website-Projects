import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Forbidden } from "@/components/admin/Forbidden";
import { POSTerminal } from "@/components/admin/pos/POSTerminal";
import { prisma } from "@/lib/prisma";
import { formatCentavosAsPHP } from "@/lib/money";
import { formatManilaDateTime, todayInManila, manilaDayStartUtc, manilaDayEndUtc } from "@/lib/timezone";

export const dynamic = "force-dynamic";
export const metadata = { title: "Point of Sale" };

export default async function POSPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return <Forbidden />;

  const today = todayInManila();
  const todaysSales = await prisma.order.findMany({
    where: {
      channel: "POS",
      createdAt: { gte: manilaDayStartUtc(today), lt: manilaDayEndUtc(today) },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Point of Sale</h1>
      <p className="mt-1 text-sm text-neutral-500">Search or scan a product to add it to the current sale.</p>

      <div className="mt-6">
        <POSTerminal cashierName={session.user.name || session.user.email || "Staff"} role={session.user.role} />
      </div>

      {todaysSales.length > 0 && (
        <section className="mt-10">
          <h2 className="font-medium text-neutral-900">Today&apos;s in-store sales</h2>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Time</th>
                  <th className="px-4 py-2.5 font-medium">Cashier</th>
                  <th className="px-4 py-2.5 font-medium">Total</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {todaysSales.map((sale) => (
                  <tr key={sale.id} className="border-b border-neutral-100 last:border-b-0">
                    <td className="px-4 py-2.5 text-neutral-500">{formatManilaDateTime(sale.createdAt)}</td>
                    <td className="px-4 py-2.5 text-neutral-700">{sale.cashierName}</td>
                    <td className="px-4 py-2.5 font-medium text-neutral-900">{formatCentavosAsPHP(sale.totalCentavos)}</td>
                    <td className="px-4 py-2.5">
                      {sale.voidedAt ? (
                        <span className="rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-500">Voided</span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">Completed</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/admin/pos/${sale.id}/receipt`} className="text-sm font-medium text-brand-red hover:underline">
                        Receipt
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
