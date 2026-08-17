/** A single line item in the client-side cart, persisted to localStorage. */
export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  /** The price in effect when this item was added (sale price if one applied). */
  priceCentavos: number;
  imageUrl: string;
  quantity: number;
  /** Stock available at the time the item was added, used for client-side quantity limits. */
  stock: number;
};

export type ProductCategory =
  | "SNACKS"
  | "BEVERAGES"
  | "INSTANT_NOODLES"
  | "FROZEN_FOOD"
  | "FRESH_GROCERY"
  | "SAUCES_CONDIMENTS"
  | "BEAUTY_PERSONAL_CARE"
  | "HOUSEHOLD"
  | "KITCHENWARE"
  | "OTHER";

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  SNACKS: "Snacks",
  BEVERAGES: "Beverages",
  INSTANT_NOODLES: "Instant Noodles",
  FROZEN_FOOD: "Frozen Food",
  FRESH_GROCERY: "Fresh Grocery",
  SAUCES_CONDIMENTS: "Sauces & Condiments",
  BEAUTY_PERSONAL_CARE: "Beauty & Personal Care",
  HOUSEHOLD: "Household",
  KITCHENWARE: "Kitchenware",
  OTHER: "Other",
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as ProductCategory[];

export type ProductStatus = "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK";

/** Plain product shape used by UI components, decoupled from the Prisma model. */
export type ProductView = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCentavos: number;
  salePriceCentavos: number | null;
  imageUrl: string;
  stock: number;
  category: ProductCategory;
  status: ProductStatus;
  isFeatured: boolean;
  isBestSeller: boolean;
};

/** The price a customer actually pays — the sale price if one is set. */
export function effectivePrice(product: Pick<ProductView, "priceCentavos" | "salePriceCentavos">): number {
  return product.salePriceCentavos ?? product.priceCentavos;
}

/** Whether a customer can currently add this product to their cart. */
export function isPurchasable(product: Pick<ProductView, "status" | "stock">): boolean {
  return product.status === "ACTIVE" && product.stock > 0;
}

// Fulfillment pipeline, tracked separately from payment status.
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_DELIVERY"
  | "OUT_FOR_DELIVERY"
  | "COMPLETED"
  | "CANCELLED";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY_FOR_DELIVERY: "Ready for Delivery",
  OUT_FOR_DELIVERY: "Out for Delivery",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
];

// Verified independently of order fulfillment — never implied by it.
export type PaymentStatus = "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "REFUNDED";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

export type PaymentMethodType = "gcash" | "paymaya" | "card" | "cod" | "bank_transfer" | "cash";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  gcash: "GCash",
  paymaya: "Maya",
  card: "Card",
  cod: "Cash on Delivery",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
};

export type SalesChannel = "ONLINE" | "POS";

export const SALES_CHANNEL_LABELS: Record<SalesChannel, string> = {
  ONLINE: "Online",
  POS: "In-store (POS)",
};

export type StockMovementType =
  | "ONLINE_SALE"
  | "POS_SALE"
  | "RESTOCK"
  | "MANUAL_ADJUSTMENT"
  | "RETURN"
  | "CANCELLATION"
  | "REFUND";

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  ONLINE_SALE: "Online sale",
  POS_SALE: "POS sale",
  RESTOCK: "Restock",
  MANUAL_ADJUSTMENT: "Manual adjustment",
  RETURN: "Return",
  CANCELLATION: "Cancellation",
  REFUND: "Refund",
};
