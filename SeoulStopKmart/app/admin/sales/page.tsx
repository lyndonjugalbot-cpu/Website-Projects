import Link from "next/link";
import { getServerSession } from "next-auth";
import type { Prisma } from "@/generated/prisma/client";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Forbidden } from "@/components/admin/Forbidden";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { formatCentavosAsPHP } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/types";
import { formatManilaDateTime, manilaDayEndUtc, manilaDayStartUtc, todayInManila } from "@/lib/timezone";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sales history" };

const PAGE_SIZE = 50;
const POS_METHODS = ["cash", "gcash", "split", "paymaya", "bank_transfer"] as const;

const STATUSES = {
  completed: "Completed",
  partial: "Partly refunded",
  refunded: "Refunded",
  voided: "Voided",
} as const;
type Status = keyof typeof STATUSES;

const STATUS_WHERE: Record<Status, Prisma.OrderWhereInput> = {
  completed: { voidedAt: null, paymentStatus: "PAID", refundedCentavos: 0 },
  partial: { voidedAt: null, paymentStatus: "PAID", refundedCentavos: { gt: 0 } },
  refunded: { voidedAt: null, paymentStatus: "REFUNDED" },
  voided: { voidedAt: { not: null } },
};

const STATUS_BADGE: Record<Status, string> = {
  completed: "bg-emerald-100 text-emerald-700",
  partial: "bg-amber-100 text-amber-800",
  refunded: "bg-red-100 text-red-700",
  voided: "bg-neutral-200 text-neutral-500",
};

function statusOf(o: { voidedAt: Date | null; paymentStatus: string; refundedCentavos: number }): Status {
  if (o.voidedAt) return "voided";
  if (o.paymentStatus === "REFUNDED") return "refunded";
  return o.refundedCentavos > 0 ? "partial" : "completed";
}

const isDate = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

/**
 * Every in-store sale, newest first — today's (auto-refreshing while the
 * range includes today) and all older ones. Managers/owners open a sale's
 * receipt from here to void or refund it.
 */
export default async function SalesHistoryPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; cashier?: string; method?: string; status?: string; q?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !roleAtLeast(session.user.role, "MANAGER")) return <Forbidden />;

  const today = todayInManila();
  // "All" in the From box (the "All time" link) lifts the lower bound.
  const allTime = searchParams.from === "all";
  const from = isDate(searchParams.from) ? searchParams.from! : today;
  const to = isDate(searchParams.to) ? searchParams.to! : today;
  const status = searchParams.status && searchParams.status in STATUSES ? (searchParams.status as Status) : undefined;
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);
  const q = searchParams.q?.trim();

  const where: Prisma.OrderWhereInput = {
    channel: "POS",
    createdAt: { ...(allTime ? {} : { gte: manilaDayStartUtc(from) }), lt: manilaDayEndUtc(to) },
    ...(searchParams.cashier ? { cashierName: searchParams.cashier } : {}),
    ...(searchParams.method ? { paymentMethod: searchParams.method } : {}),
    ...(status ? STATUS_WHERE[status] : {}),
    ...(q
      ? {
          OR: [
            { id: { startsWith: q.replace(/^#/, "").toLowerCase() } },
            { customerName: { contains: q, mode: "insensitive" } },
            { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [sales, count, kept, voided, cashiers] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: { select: { quantity: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
    // Money taken: every non-voided sale in the filter (refunds are shown separately).
    prisma.order.aggregate({
      where: { AND: [where, { voidedAt: null }] },
      _sum: { totalCentavos: true, refundedCentavos: true },
      _count: true,
    }),
    prisma.order.aggregate({ where: { AND: [where, { voidedAt: { not: null } }] }, _sum: { totalCentavos: true }, _count: true }),
    prisma.order.findMany({
      where: { channel: "POS", cashierName: { not: null } },
      distinct: ["cashierName"],
      select: { cashierName: true },
      orderBy: { cashierName: "asc" },
    }),
  ]);

  const takenCentavos = kept._sum.totalCentavos ?? 0;
  const refundedCentavos = kept._sum.refundedCentavos ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const isLive = allTime || to >= today;

  const linkWith = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...searchParams, ...patch })) if (v) params.set(k, v);
    const qs = params.toString();
    return `/admin/sales${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      {isLive && <AutoRefresh seconds={30} />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Sales history</h1>
          <p className="mt-1 text-sm text-neutral-500">
            In-store sales, newest first.{isLive && " New sales show up automatically."} Open a receipt to void or refund it.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/admin/sales" className="rounded-full border border-neutral-300 px-3.5 py-1.5 font-medium text-neutral-700 hover:bg-neutral-100">
            Today
          </Link>
          <Link href="/admin/sales?from=all" className="rounded-full border border-neutral-300 px-3.5 py-1.5 font-medium text-neutral-700 hover:bg-neutral-100">
            All time
          </Link>
        </div>
      </div>

      <form method="get" className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">From</span>
          <input type="date" name="from" defaultValue={allTime ? "" : from} max={today} className="input py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">To</span>
          <input type="date" name="to" defaultValue={to} max={today} className="input py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">Cashier</span>
          <select name="cashier" defaultValue={searchParams.cashier ?? ""} className="input py-1.5">
            <option value="">Everyone</option>
            {cashiers.map((c) => (
              <option key={c.cashierName} value={c.cashierName!}>{c.cashierName}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">Payment</span>
          <select name="method" defaultValue={searchParams.method ?? ""} className="input py-1.5">
            <option value="">All methods</option>
            {POS_METHODS.map((m) => (
              <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">Status</span>
          <select name="status" defaultValue={status ?? ""} className="input py-1.5">
            <option value="">All</option>
            {Object.entries(STATUSES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">Search</span>
          <input type="text" name="q" defaultValue={q ?? ""} placeholder="Receipt #, customer, item" className="input py-1.5" />
        </label>
        <div className="col-span-full flex justify-end gap-2">
          <Link href="/admin/sales" className="rounded-full px-4 py-2 font-medium text-neutral-600 hover:bg-neutral-100">
            Reset
          </Link>
          <button type="submit" className="rounded-full bg-brand-red px-5 py-2 font-medium text-white hover:bg-brand-red-dark">
            Apply
          </button>
        </div>
      </form>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sales" value={kept._count.toLocaleString()} hint={`${allTime ? "All time" : from === to ? from : `${from} → ${to}`}`} />
        <Stat label="Taken in" value={formatCentavosAsPHP(takenCentavos)} hint="Sale totals, voids excluded" />
        <Stat label="Refunded" value={formatCentavosAsPHP(refundedCentavos)} hint="Paid back to customers" />
        <Stat
          label="Net"
          value={formatCentavosAsPHP(takenCentavos - refundedCentavos)}
          hint={voided._count > 0 ? `${voided._count} voided (${formatCentavosAsPHP(voided._sum.totalCentavos ?? 0)}) not counted` : "Taken in − refunded"}
        />
      </div>

      {sales.length === 0 ? (
        <p className="mt-10 text-neutral-500">No sales match these filters.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Receipt</th>
                <th className="px-4 py-3 font-medium">Cashier</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const st = statusOf(sale);
                const units = sale.items.reduce((n, i) => n + i.quantity, 0);
                return (
                  <tr key={sale.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">{formatManilaDateTime(sale.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/pos/${sale.id}/receipt`} className="font-mono text-xs text-brand-red hover:underline">
                        #{sale.id.slice(0, 10).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{sale.cashierName}</td>
                    <td className="px-4 py-3 text-neutral-700">{sale.customerName ?? "Walk-in"}</td>
                    <td className="px-4 py-3 text-neutral-600">{units}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      {PAYMENT_METHOD_LABELS[sale.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? sale.paymentMethod}
                      {sale.gcashAmountCentavos !== null && (
                        <span className="block text-xs text-neutral-500">
                          GCash {formatCentavosAsPHP(sale.gcashAmountCentavos)} · Cash {formatCentavosAsPHP(sale.totalCentavos - sale.gcashAmountCentavos)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-neutral-900">
                      <span className={st === "voided" ? "text-neutral-400 line-through" : ""}>{formatCentavosAsPHP(sale.totalCentavos)}</span>
                      {sale.refundedCentavos > 0 && (
                        <span className="block text-xs font-normal text-red-600">−{formatCentavosAsPHP(sale.refundedCentavos)} refunded</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[st]}`}>{STATUSES[st]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-neutral-600">
          <span>
            Page {page} of {pages} · {count.toLocaleString()} sales
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={linkWith({ page: String(page - 1) })} className="rounded-full border border-neutral-300 px-3.5 py-1.5 font-medium hover:bg-neutral-100">
                ← Newer
              </Link>
            )}
            {page < pages && (
              <Link href={linkWith({ page: String(page + 1) })} className="rounded-full border border-neutral-300 px-3.5 py-1.5 font-medium hover:bg-neutral-100">
                Older →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}
