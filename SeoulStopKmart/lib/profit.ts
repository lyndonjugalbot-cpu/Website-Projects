// Operating costs and the running-profit overview. Shared by the Reports
// page (lib/reports.ts) and the Profit tracker (app/admin/profit) so both
// always agree.
//
//   net profit = net sales − cost of goods sold − operating costs
//   operating costs = logged expenses + bills marked paid + payslips
//
// Supplier delivery receipts are deliberately NOT a cost here: they buy
// stock, and that stock's cost is already counted (as COGS) when it sells.
// Subtracting both would count the same money twice.
import { prisma } from "@/lib/prisma";
import { manilaDateOf } from "@/lib/deliveries";
import { manilaDayEndUtc, manilaDayStartUtc, todayInManila } from "@/lib/timezone";

export type OperatingCosts = {
  expensesCentavos: number;
  billsPaidCentavos: number;
  payrollCentavos: number;
  totalCentavos: number;
};

/**
 * Operating costs in [startUtc, endUtc). Each kind is dated by when it hit:
 * expenses by their date, bills by the date they were paid, payslips by the
 * end of the pay period.
 */
export async function getOperatingCosts(startUtc: Date, endUtc: Date): Promise<OperatingCosts> {
  const [expenses, bills, payslips] = await Promise.all([
    prisma.expense.aggregate({ where: { date: { gte: startUtc, lt: endUtc } }, _sum: { amountCentavos: true } }),
    prisma.bill.findMany({
      where: { isPaid: true, paidAt: { gte: startUtc, lt: endUtc } },
      select: { amountCentavos: true, paidAmountCentavos: true },
    }),
    prisma.payslip.aggregate({ where: { periodEnd: { gte: startUtc, lt: endUtc } }, _sum: { netPayCentavos: true } }),
  ]);
  const expensesCentavos = expenses._sum.amountCentavos ?? 0;
  const billsPaidCentavos = bills.reduce((s, b) => s + (b.paidAmountCentavos ?? b.amountCentavos), 0);
  const payrollCentavos = payslips._sum.netPayCentavos ?? 0;
  return {
    expensesCentavos,
    billsPaidCentavos,
    payrollCentavos,
    totalCentavos: expensesCentavos + billsPaidCentavos + payrollCentavos,
  };
}

export type ProfitDay = {
  date: string; // YYYY-MM-DD (Manila)
  netSalesCentavos: number;
  cogsCentavos: number;
  costsCentavos: number;
  profitCentavos: number;
  cumulativeProfitCentavos: number;
};

export type ProfitSeries = {
  /** First day with any sale or cost — the "since we started" date. */
  startDate: string;
  endDate: string;
  days: ProfitDay[];
  totals: {
    netSalesCentavos: number;
    cogsCentavos: number;
    grossProfitCentavos: number;
    costs: OperatingCosts;
    netProfitCentavos: number;
    transactions: number;
    /** Sold units whose product had no cost on file — their profit is overstated. */
    unitsMissingCost: number;
  };
};

const DAY_MS = 86_400_000;
const addDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);

/**
 * Day-by-day profit from `startDate` to `endDate` (Manila dates), with the
 * running (cumulative) total. When `startDate` is omitted, starts at the
 * first day anything was sold or paid.
 */
export async function getProfitSeries(startDate?: string, endDate: string = todayInManila()): Promise<ProfitSeries> {
  const endUtc = manilaDayEndUtc(endDate);

  // Orders that counted as sales: payment verified PAID (voided/refunded POS
  // sales flip to REFUNDED and therefore drop out, exactly like Reports).
  const orderWhereBase = { paymentStatus: "PAID" as const, createdAt: { lt: endUtc } };
  let start = startDate;
  if (!start) {
    const [firstOrder, firstExpense, firstBill, firstPayslip] = await Promise.all([
      prisma.order.findFirst({ where: orderWhereBase, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      prisma.expense.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
      prisma.bill.findFirst({ where: { isPaid: true, paidAt: { not: null } }, orderBy: { paidAt: "asc" }, select: { paidAt: true } }),
      prisma.payslip.findFirst({ orderBy: { periodEnd: "asc" }, select: { periodEnd: true } }),
    ]);
    const candidates = [firstOrder?.createdAt, firstExpense?.date, firstBill?.paidAt, firstPayslip?.periodEnd]
      .filter((d): d is Date => Boolean(d))
      .map(manilaDateOf)
      .sort();
    start = candidates[0] ?? endDate;
  }
  if (start > endDate) start = endDate;
  const startUtc = manilaDayStartUtc(start);

  const [orders, expenses, bills, payslips] = await Promise.all([
    prisma.order.findMany({
      where: { ...orderWhereBase, createdAt: { gte: startUtc, lt: endUtc } },
      select: {
        createdAt: true,
        subtotalCentavos: true,
        discountCentavos: true,
        deliveryFeeCentavos: true,
        items: { select: { quantity: true, unitCostCentavos: true } },
      },
    }),
    prisma.expense.findMany({ where: { date: { gte: startUtc, lt: endUtc } }, select: { date: true, amountCentavos: true } }),
    prisma.bill.findMany({
      where: { isPaid: true, paidAt: { gte: startUtc, lt: endUtc } },
      select: { paidAt: true, amountCentavos: true, paidAmountCentavos: true },
    }),
    prisma.payslip.findMany({ where: { periodEnd: { gte: startUtc, lt: endUtc } }, select: { periodEnd: true, netPayCentavos: true } }),
  ]);

  const byDay = new Map<string, { sales: number; cogs: number; costs: number }>();
  const day = (d: Date) => {
    const key = manilaDateOf(d);
    let row = byDay.get(key);
    if (!row) byDay.set(key, (row = { sales: 0, cogs: 0, costs: 0 }));
    return row;
  };

  const totals = { sales: 0, cogs: 0, transactions: orders.length, unitsMissingCost: 0 };
  for (const o of orders) {
    const row = day(o.createdAt);
    // Order.subtotal is the sum of its lines (gross sales), so net sales
    // here is the same figure Reports calls "net sales" for this order.
    const net = o.subtotalCentavos - o.discountCentavos + o.deliveryFeeCentavos;
    row.sales += net;
    totals.sales += net;
    for (const item of o.items) {
      if (item.unitCostCentavos === null) totals.unitsMissingCost += item.quantity;
      const cost = (item.unitCostCentavos ?? 0) * item.quantity;
      row.cogs += cost;
      totals.cogs += cost;
    }
  }

  const costs: OperatingCosts = { expensesCentavos: 0, billsPaidCentavos: 0, payrollCentavos: 0, totalCentavos: 0 };
  for (const e of expenses) {
    day(e.date).costs += e.amountCentavos;
    costs.expensesCentavos += e.amountCentavos;
  }
  for (const b of bills) {
    const amount = b.paidAmountCentavos ?? b.amountCentavos;
    day(b.paidAt as Date).costs += amount;
    costs.billsPaidCentavos += amount;
  }
  for (const p of payslips) {
    day(p.periodEnd).costs += p.netPayCentavos;
    costs.payrollCentavos += p.netPayCentavos;
  }
  costs.totalCentavos = costs.expensesCentavos + costs.billsPaidCentavos + costs.payrollCentavos;

  // Zero-filled so a quiet day shows as a flat step, not a gap.
  const days: ProfitDay[] = [];
  let cumulative = 0;
  for (let d = start; d <= endDate; d = addDays(d, 1)) {
    const row = byDay.get(d) ?? { sales: 0, cogs: 0, costs: 0 };
    const profit = row.sales - row.cogs - row.costs;
    cumulative += profit;
    days.push({
      date: d,
      netSalesCentavos: row.sales,
      cogsCentavos: row.cogs,
      costsCentavos: row.costs,
      profitCentavos: profit,
      cumulativeProfitCentavos: cumulative,
    });
  }

  return {
    startDate: start,
    endDate,
    days,
    totals: {
      netSalesCentavos: totals.sales,
      cogsCentavos: totals.cogs,
      grossProfitCentavos: totals.sales - totals.cogs,
      costs,
      netProfitCentavos: totals.sales - totals.cogs - costs.totalCentavos,
      transactions: totals.transactions,
      unitsMissingCost: totals.unitsMissingCost,
    },
  };
}
