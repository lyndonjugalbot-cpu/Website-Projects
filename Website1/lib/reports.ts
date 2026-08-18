import { prisma } from "@/lib/prisma";
import { manilaDayStartUtc, manilaDayEndUtc } from "@/lib/timezone";
import type { ProductCategory, SalesChannel } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

export type ReportFilters = {
  /** "YYYY-MM-DD", inclusive, interpreted as Asia/Manila local dates. */
  startDate: string;
  endDate: string;
  channel?: SalesChannel;
  category?: ProductCategory;
  paymentMethod?: string;
  orderStatus?: string;
};

export type ProductSalesLine = {
  productId: string | null;
  productName: string;
  quantity: number;
  revenueCentavos: number;
  costCentavos: number;
  profitCentavos: number;
};

export type CategorySalesLine = {
  category: ProductCategory | "UNKNOWN";
  label: string;
  quantity: number;
  revenueCentavos: number;
};

export type PaymentMethodLine = { method: string; count: number; totalCentavos: number };
export type ChannelLine = { channel: SalesChannel; count: number; totalCentavos: number };

export type ReportResult = {
  filters: ReportFilters;
  transactionsCount: number;
  unitsSold: number;
  grossSalesCentavos: number;
  discountsCentavos: number;
  refundsCentavos: number;
  deliveryIncomeCentavos: number;
  netSalesCentavos: number;
  cogsCentavos: number;
  itemsMissingCostCount: number;
  grossProfitCentavos: number;
  grossProfitMarginPercent: number;
  paymentProcessingFeesCentavos: number;
  operatingExpensesCentavos: number;
  netProfitCentavos: number;
  salesByProduct: ProductSalesLine[];
  salesByCategory: CategorySalesLine[];
  salesByPaymentMethod: PaymentMethodLine[];
  salesByChannel: ChannelLine[];
  lowStockProducts: { id: string; name: string; stock: number; lowStockThreshold: number }[];
  inventoryValuationCentavos: number;
  productsMissingCostCount: number;
};

/**
 * Every number here is computed from `Order`/`OrderItem` rows that already
 * exist for other reasons (checkout, POS sales, admin edits) — nothing is
 * tracked specially "for reporting." See the formulas below; the same
 * shape is rendered with the same labels in app/admin/reports/page.tsx so
 * the UI and this function never drift apart.
 */
export async function generateReport(filters: ReportFilters): Promise<ReportResult> {
  const startUtc = manilaDayStartUtc(filters.startDate);
  const endUtc = manilaDayEndUtc(filters.endDate);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: startUtc, lt: endUtc },
      ...(filters.channel ? { channel: filters.channel } : {}),
      ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
      ...(filters.orderStatus ? { orderStatus: filters.orderStatus as never } : {}),
      ...(filters.category
        ? { items: { some: { product: { category: filters.category } } } }
        : {}),
    },
    include: { items: { include: { product: { select: { category: true } } } } },
  });

  // A "sale" = payment verified PAID (see lib/orders.ts / lib/pos.ts for how
  // that's asserted per channel). Orders still PENDING/PROCESSING/FAILED
  // never happened financially, so they're excluded entirely. Orders whose
  // payment was later REFUNDED are tracked separately below.
  const soldOrders = orders.filter((o) => o.paymentStatus === "PAID");
  const refundedOrders = orders.filter((o) => o.paymentStatus === "REFUNDED");

  let grossSalesCentavos = 0;
  let unitsSold = 0;
  let cogsCentavos = 0;
  let itemsMissingCostCount = 0;
  const byProduct = new Map<string, ProductSalesLine>();
  const byCategory = new Map<string, CategorySalesLine>();

  // Walk every line item of every sold order once, accumulating totals and
  // the per-product / per-category breakdown tables at the same time.
  for (const order of soldOrders) {
    for (const item of order.items) {
      grossSalesCentavos += item.subtotalCentavos;
      unitsSold += item.quantity;
      const lineCost = (item.unitCostCentavos ?? 0) * item.quantity;
      cogsCentavos += lineCost;
      if (item.unitCostCentavos === null) itemsMissingCostCount += 1;

      const key = item.productId ?? item.productName;
      const existing = byProduct.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenueCentavos += item.subtotalCentavos;
        existing.costCentavos += lineCost;
        existing.profitCentavos += item.subtotalCentavos - lineCost;
      } else {
        byProduct.set(key, {
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          revenueCentavos: item.subtotalCentavos,
          costCentavos: lineCost,
          profitCentavos: item.subtotalCentavos - lineCost,
        });
      }

      const category = (item as unknown as { product: { category: ProductCategory } | null }).product?.category;
      const catKey = category ?? "UNKNOWN";
      const catExisting = byCategory.get(catKey);
      if (catExisting) {
        catExisting.quantity += item.quantity;
        catExisting.revenueCentavos += item.subtotalCentavos;
      } else {
        byCategory.set(catKey, {
          category: catKey as ProductCategory | "UNKNOWN",
          label: category ? CATEGORY_LABELS[category] : "Unknown / deleted product",
          quantity: item.quantity,
          revenueCentavos: item.subtotalCentavos,
        });
      }
    }
  }

  const discountsCentavos = soldOrders.reduce((sum, o) => sum + o.discountCentavos, 0);
  const deliveryIncomeCentavos = soldOrders.reduce((sum, o) => sum + o.deliveryFeeCentavos, 0);
  const refundsCentavos = refundedOrders.reduce((sum, o) => sum + o.totalCentavos, 0);

  // The core formulas — also shown to the admin directly in the Reports UI
  // (components/admin/ReportsView.tsx) so nothing here is a "hidden" number.
  const netSalesCentavos = grossSalesCentavos - discountsCentavos + deliveryIncomeCentavos - refundsCentavos;
  const grossProfitCentavos = netSalesCentavos - cogsCentavos;
  const grossProfitMarginPercent = netSalesCentavos > 0 ? (grossProfitCentavos / netSalesCentavos) * 100 : 0;

  const expenses = await prisma.expense.findMany({ where: { date: { gte: startUtc, lt: endUtc } } });
  const operatingExpensesCentavos = expenses.reduce((sum, e) => sum + e.amountCentavos, 0);

  // PayMongo's API does return a `fee` on the underlying Payment resource,
  // but this integration only stores Payment Intent IDs, not individual
  // Payment fetches — so processing fees aren't available yet. Shown as 0
  // with this called out explicitly rather than silently omitted.
  const paymentProcessingFeesCentavos = 0;

  const netProfitCentavos = grossProfitCentavos - operatingExpensesCentavos - paymentProcessingFeesCentavos;

  const paymentMethodMap = new Map<string, PaymentMethodLine>();
  const channelMap = new Map<SalesChannel, ChannelLine>();
  for (const order of soldOrders) {
    const method = order.paymentMethod ?? "unknown";
    const pm = paymentMethodMap.get(method) ?? { method, count: 0, totalCentavos: 0 };
    pm.count += 1;
    pm.totalCentavos += order.totalCentavos;
    paymentMethodMap.set(method, pm);

    const ch = channelMap.get(order.channel as SalesChannel) ?? {
      channel: order.channel as SalesChannel,
      count: 0,
      totalCentavos: 0,
    };
    ch.count += 1;
    ch.totalCentavos += order.totalCentavos;
    channelMap.set(order.channel as SalesChannel, ch);
  }

  // Point-in-time snapshots — not affected by the date range filter, since
  // "what's low right now" and "what's my inventory worth right now" are
  // both about current state, not historical activity.
  const allProducts = await prisma.product.findMany({ where: { status: { not: "INACTIVE" } } });
  const lowStockProducts = allProducts
    .filter((p) => p.stock <= p.lowStockThreshold)
    .map((p) => ({ id: p.id, name: p.name, stock: p.stock, lowStockThreshold: p.lowStockThreshold }))
    .sort((a, b) => a.stock - b.stock);

  const inventoryValuationCentavos = allProducts.reduce((sum, p) => sum + p.stock * (p.costCentavos ?? 0), 0);
  const productsMissingCostCount = allProducts.filter((p) => p.costCentavos === null).length;

  return {
    filters,
    transactionsCount: soldOrders.length,
    unitsSold,
    grossSalesCentavos,
    discountsCentavos,
    refundsCentavos,
    deliveryIncomeCentavos,
    netSalesCentavos,
    cogsCentavos,
    itemsMissingCostCount,
    grossProfitCentavos,
    grossProfitMarginPercent,
    paymentProcessingFeesCentavos,
    operatingExpensesCentavos,
    netProfitCentavos,
    salesByProduct: Array.from(byProduct.values()).sort((a, b) => b.revenueCentavos - a.revenueCentavos),
    salesByCategory: Array.from(byCategory.values()).sort((a, b) => b.revenueCentavos - a.revenueCentavos),
    salesByPaymentMethod: Array.from(paymentMethodMap.values()).sort((a, b) => b.totalCentavos - a.totalCentavos),
    salesByChannel: Array.from(channelMap.values()),
    lowStockProducts,
    inventoryValuationCentavos,
    productsMissingCostCount,
  };
}
