"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCentavosAsPHP } from "@/lib/money";
import { ALL_CATEGORIES, CATEGORY_LABELS, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, SALES_CHANNEL_LABELS } from "@/lib/types";
import type { ReportResult } from "@/lib/reports";

type Filters = {
  startDate: string;
  endDate: string;
  channel: string;
  category: string;
  paymentMethod: string;
  orderStatus: string;
};

export function ReportsView({ initialFilters }: { initialFilters: Pick<Filters, "startDate" | "endDate"> }) {
  const [filters, setFilters] = useState<Filters>({
    ...initialFilters,
    channel: "",
    category: "",
    paymentMethod: "",
    orderStatus: "",
  });
  const [report, setReport] = useState<ReportResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("startDate", filters.startDate);
      params.set("endDate", filters.endDate);
      if (filters.channel) params.set("channel", filters.channel);
      if (filters.category) params.set("category", filters.category);
      if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod);
      if (filters.orderStatus) params.set("orderStatus", filters.orderStatus);
      const res = await fetch(`/api/admin/reports?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load report");
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load report");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          loadReport();
        }}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-5"
      >
        <FilterField label="Start date">
          <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="input" required />
        </FilterField>
        <FilterField label="End date">
          <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="input" required />
        </FilterField>
        <FilterField label="Channel">
          <select value={filters.channel} onChange={(e) => setFilters({ ...filters, channel: e.target.value })} className="input">
            <option value="">All channels</option>
            <option value="ONLINE">{SALES_CHANNEL_LABELS.ONLINE}</option>
            <option value="POS">{SALES_CHANNEL_LABELS.POS}</option>
          </select>
        </FilterField>
        <FilterField label="Category">
          <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} className="input">
            <option value="">All categories</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Payment method">
          <select value={filters.paymentMethod} onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })} className="input">
            <option value="">All methods</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Order status">
          <select value={filters.orderStatus} onChange={(e) => setFilters({ ...filters, orderStatus: e.target.value })} className="input">
            <option value="">All statuses</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </FilterField>
        <button type="submit" className="rounded-full bg-brand-red px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red-dark">
          Run report
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {isLoading && <p className="text-sm text-neutral-400">Loading report&hellip;</p>}

      {report && !isLoading && (
        <>
          <section>
            <h2 className="font-medium text-neutral-900">Sales summary</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Transactions" value={String(report.transactionsCount)} formula="Count of PAID orders in range" />
              <Kpi label="Units sold" value={String(report.unitsSold)} formula="Sum of item quantities" />
              <Kpi label="Gross sales" value={formatCentavosAsPHP(report.grossSalesCentavos)} formula="Sum of item selling prices" />
              <Kpi label="Discounts" value={formatCentavosAsPHP(report.discountsCentavos)} formula="Sum of order-level discounts" />
              <Kpi label="Refunds" value={formatCentavosAsPHP(report.refundsCentavos)} formula="Sum of totals on REFUNDED orders" />
              <Kpi label="Delivery income" value={formatCentavosAsPHP(report.deliveryIncomeCentavos)} formula="Sum of delivery fees collected" />
              <Kpi
                label="Net sales"
                value={formatCentavosAsPHP(report.netSalesCentavos)}
                formula="Gross sales − discounts + delivery income − refunds"
                highlight
              />
              <Kpi
                label="Cost of goods sold"
                value={formatCentavosAsPHP(report.cogsCentavos)}
                formula={`Sum of unit cost × qty${report.itemsMissingCostCount > 0 ? ` (${report.itemsMissingCostCount} items missing cost, counted as ₱0)` : ""}`}
              />
              <Kpi
                label="Gross profit"
                value={formatCentavosAsPHP(report.grossProfitCentavos)}
                formula="Net sales − COGS"
                highlight
              />
              <Kpi label="Gross margin" value={`${report.grossProfitMarginPercent.toFixed(1)}%`} formula="Gross profit ÷ net sales" />
              <Kpi label="Payment processing fees" value={formatCentavosAsPHP(report.paymentProcessingFeesCentavos)} formula="Not tracked yet — see README" />
              <Kpi label="Operating expenses" value={formatCentavosAsPHP(report.operatingExpensesCentavos)} formula="Sum of expenses logged in range" />
              <Kpi
                label="Net profit / loss"
                value={formatCentavosAsPHP(report.netProfitCentavos)}
                formula="Gross profit − opex − payment fees"
                highlight
                negative={report.netProfitCentavos < 0}
              />
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ReportTable
              title="Top-selling products"
              rows={report.salesByProduct.slice(0, 10)}
              columns={[
                { label: "Product", render: (r) => r.productName },
                { label: "Units", render: (r) => String(r.quantity) },
                { label: "Revenue", render: (r) => formatCentavosAsPHP(r.revenueCentavos) },
                { label: "Profit", render: (r) => formatCentavosAsPHP(r.profitCentavos) },
              ]}
              emptyText="No sales in this range."
            />
            <ReportTable
              title="Sales by category"
              rows={report.salesByCategory}
              columns={[
                { label: "Category", render: (r) => r.label },
                { label: "Units", render: (r) => String(r.quantity) },
                { label: "Revenue", render: (r) => formatCentavosAsPHP(r.revenueCentavos) },
              ]}
              emptyText="No sales in this range."
            />
            <ReportTable
              title="Sales by payment method"
              rows={report.salesByPaymentMethod}
              columns={[
                { label: "Method", render: (r) => PAYMENT_METHOD_LABELS[r.method as keyof typeof PAYMENT_METHOD_LABELS] ?? r.method },
                { label: "Transactions", render: (r) => String(r.count) },
                { label: "Total", render: (r) => formatCentavosAsPHP(r.totalCentavos) },
              ]}
              emptyText="No sales in this range."
            />
            <ReportTable
              title="POS vs. online"
              rows={report.salesByChannel}
              columns={[
                { label: "Channel", render: (r) => SALES_CHANNEL_LABELS[r.channel] },
                { label: "Transactions", render: (r) => String(r.count) },
                { label: "Total", render: (r) => formatCentavosAsPHP(r.totalCentavos) },
              ]}
              emptyText="No sales in this range."
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h3 className="font-medium text-neutral-900">Low stock (as of now)</h3>
              {report.lowStockProducts.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500">Nothing low on stock.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  {report.lowStockProducts.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span className="text-neutral-700">{p.name}</span>
                      <span className={p.stock === 0 ? "font-medium text-red-600" : "font-medium text-amber-600"}>
                        {p.stock} / threshold {p.lowStockThreshold}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h3 className="font-medium text-neutral-900">Inventory valuation (as of now)</h3>
              <p className="mt-3 text-2xl font-semibold text-neutral-900">{formatCentavosAsPHP(report.inventoryValuationCentavos)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                Sum of stock × cost across all active/out-of-stock products.
                {report.productsMissingCostCount > 0 && ` ${report.productsMissingCostCount} products have no cost entered (counted as ₱0).`}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

function Kpi({ label, value, formula, highlight, negative }: { label: string; value: string; formula: string; highlight?: boolean; negative?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-brand-red/30 bg-brand-red/5" : "border-neutral-200 bg-white"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${negative ? "text-red-600" : "text-neutral-900"}`}>{value}</p>
      <p className="mt-1 text-[11px] text-neutral-400">{formula}</p>
    </div>
  );
}

function ReportTable<T>({
  title,
  rows,
  columns,
  emptyText,
}: {
  title: string;
  rows: T[];
  columns: { label: string; render: (row: T) => string }[];
  emptyText: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h3 className="font-medium text-neutral-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">{emptyText}</p>
      ) : (
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              {columns.map((c) => (
                <th key={c.label} className="py-1.5 font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-neutral-100">
                {columns.map((c) => (
                  <td key={c.label} className="py-1.5 text-neutral-700">{c.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
