/** A single line item in the client-side cart, persisted to localStorage. */
export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  priceCentavos: number;
  imageUrl: string;
  quantity: number;
  /** Stock available at the time the item was added, used for client-side quantity limits. */
  stock: number;
};

/** Plain product shape used by UI components, decoupled from the Prisma model. */
export type ProductView = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCentavos: number;
  imageUrl: string;
  stock: number;
};

export type OrderStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";

export type PaymentMethodType = "gcash" | "paymaya" | "card";
