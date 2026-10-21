import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Forbidden } from "@/components/admin/Forbidden";
import { formatCentavosAsPHP } from "@/lib/money";
import { getProfitSeries, type ProfitDay } from "@/lib/profit";
import { manilaDayEndUtc, manilaDayStartUtc, todayInManila } from "@/lib/timezone";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profit" };

const sum = (days: ProfitDay[]) => days.reduce((s, d) => s + d.profitCentavos, 0);

export default async function ProfitPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !roleAtLeast(session.user.role, "MANAGER")) return <Forbidden />;

  const today = todayInManila();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [series, productsMissingCost, deliveriesThisMonth] = await Promise.all([
    getProfitSeries(),
    prisma.product.count({ where: { costCentavos: null, status: { not: "INACTIVE" }, posOnly: false } }),
    prisma.deliveryReceipt.aggregate({
      where: { date: { gte: manilaDayStartUtc(monthStart), lt: manilaDayEndUtc(today) } },
      _sum: { amountCentavos: true },
    }),
  ]);

  const { totals, days } = series;
  const todayProfit = days.find((d) => d.date === today)?.profitCentavos ?? 0;
  const last7 = sum(days.slice(-7));
  const thisMonth = sum(days.filter((d) => d.date >= monthStart));
  const margin = totals.netSalesCentavos > 0 ? (totals.grossProfitCentavos / totals.netSalesCentavos) * 100 : 0;
  const hasData = totals.transactions > 0 || totals.costs.totalCentavos > 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Profit tracker</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Running profit since {series.startDate} — every POS and online sale, less what the items cost and what the business spent.
      </p>

      {/* Hero */}
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Total running profit</p>
        <p className={`mt-1 text-4xl font-semibold tracking-tight ${totals.netProfitCentavos < 0 ? "text-red-600" : "text-neutral-900"}`}>
          {formatCentavosAsPHP(totals.netProfitCentavos)}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          {totals.transactions} sale{totals.transactions === 1 ? "" : "s"} · {margin.toFixed(1)}% gross margin
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniStat label="Today" value={todayProfit} />
          <MiniStat label="Last 7 days" value={last7} />
          <MiniStat label="This month" value={thisMonth} />
        </div>
      </div>

      {(totals.unitsMissingCost > 0 || productsMissingCost > 0) && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Profit is overstated until costs are entered.</strong>{" "}
          {productsMissingCost > 0 && `${productsMissingCost} active product${productsMissingCost === 1 ? " has" : "s have"} no cost on file`}
          {totals.unitsMissingCost > 0 && `${productsMissingCost > 0 ? "; " : ""}${totals.unitsMissingCost} unit${totals.unitsMissingCost === 1 ? "" : "s"} already sold had none`}
          . Items with no cost are counted as ₱0 cost.{" "}
          <Link href="/admin/products" className="font-medium underline">
            Edit products
          </Link>
        </div>
      )}

      {!hasData ? (
        <p className="mt-8 text-sm text-neutral-500">
          No sales yet. Once the POS starts ringing up sales, profit will build up here automatically.
        </p>
      ) : (
        <>
          {/* Chart */}
          <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="font-medium text-neutral-900">Running profit over time</h2>
            <RunningChart days={days} />
          </section>

          {/* Breakdown */}
          <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="font-medium text-neutral-900">How it adds up</h2>
            <dl className="mt-4 divide-y divide-neutral-100 text-sm">
              <Row label="Net sales" sub="Sales − discounts + delivery fees (voided sales excluded)" value={totals.netSalesCentavos} />
              <Row label="Cost of goods sold" sub="What the items sold cost you" value={-totals.cogsCentavos} />
              <Row label="Gross profit" value={totals.grossProfitCentavos} bold />
              <Row label="Expenses logged" sub="Reports → expenses" value={-totals.costs.expensesCentavos} />
              <Row label="Bills paid" sub="Rent, utilities, loans marked paid on the Bills page" value={-totals.costs.billsPaidCentavos} />
              <Row label="Payroll" sub="Payslips generated" value={-totals.costs.payrollCentavos} />
              <Row label="Net profit" value={totals.netProfitCentavos} bold />
            </dl>
            <p className="mt-4 text-xs text-neutral-400">
              Supplier deliveries ({formatCentavosAsPHP(deliveriesThisMonth._sum.amountCentavos ?? 0)} logged this month) aren&apos;t deducted
              again — stock is already counted as cost when it sells.
            </p>
          </section>

          {/* Recent days */}
          <section className="mt-8 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Day</th>
                  <th className="px-4 py-3 text-right font-medium">Net sales</th>
                  <th className="px-4 py-3 text-right font-medium">Cost of goods</th>
                  <th className="px-4 py-3 text-right font-medium">Costs paid</th>
                  <th className="px-4 py-3 text-right font-medium">Profit</th>
                  <th className="px-4 py-3 text-right font-medium">Running</th>
                </tr>
              </thead>
              <tbody>
                {days
                  .slice(-14)
                  .reverse()
                  .map((d) => (
                    <tr key={d.date} className="border-b border-neutral-100 last:border-b-0">
                      <td className="px-4 py-2.5 text-neutral-700">{d.date}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-700">{formatCentavosAsPHP(d.netSalesCentavos)}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-500">{formatCentavosAsPHP(d.cogsCentavos)}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-500">{formatCentavosAsPHP(d.costsCentavos)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${d.profitCentavos < 0 ? "text-red-600" : "text-neutral-900"}`}>
                        {formatCentavosAsPHP(d.profitCentavos)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-neutral-500">{formatCentavosAsPHP(d.cumulativeProfitCentavos)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-4 py-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${value < 0 ? "text-red-600" : "text-neutral-900"}`}>{formatCentavosAsPHP(value)}</p>
    </div>
  );
}

function Row({ label, sub, value, bold }: { label: string; sub?: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className={bold ? "font-semibold text-neutral-900" : "text-neutral-700"}>
        {label}
        {sub && <span className="block text-xs font-normal text-neutral-400">{sub}</span>}
      </dt>
      <dd className={`shrink-0 tabular-nums ${bold ? "font-semibold" : ""} ${value < 0 ? "text-red-600" : "text-neutral-900"}`}>
        {formatCentavosAsPHP(value)}
      </dd>
    </div>
  );
}

/** Cumulative profit as an inline SVG line — no chart library needed. */
function RunningChart({ days }: { days: ProfitDay[] }) {
  const W = 800;
  const H = 220;
  const PAD = { l: 8, r: 8, t: 12, b: 20 };
  // Thin very long histories so the polyline stays light.
  const step = Math.max(1, Math.ceil(days.length / 400));
  const pts = days.filter((_, i) => i % step === 0 || i === days.length - 1);
  const values = pts.map((d) => d.cumulativeProfitCentavos);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const x = (i: number) => PAD.l + (pts.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i / (pts.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - (v - min) / range) * (H - PAD.t - PAD.b);
  const line = pts.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.cumulativeProfitCentavos).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const rising = last.cumulativeProfitCentavos >= 0;

  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" role="img" aria-label={`Running profit from ${pts[0].date} to ${last.date}, now ${formatCentavosAsPHP(last.cumulativeProfitCentavos)}`}>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="#d4d4d4" strokeDasharray="4 4" />
        <path d={line} fill="none" stroke={rising ? "#059669" : "#dc2626"} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(pts.length - 1)} cy={y(last.cumulativeProfitCentavos)} r={4} fill={rising ? "#059669" : "#dc2626"} />
      </svg>
      <div className="flex justify-between text-[11px] text-neutral-400">
        <span>{pts[0].date}</span>
        <span>{last.date}</span>
      </div>
    </div>
  );
}
