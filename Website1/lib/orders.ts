// Order creation and lifecycle for ONLINE (storefront checkout) orders.
// POS (in-store) sales use the same Order/OrderItem tables but go through
// lib/pos.ts instead, since a POS sale is rung up and paid in one step
// rather than created-then-paid-later like an online order.
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { effectivePrice } from "@/lib/types";
import { DELIVERY_FEE_CENTAVOS } from "@/lib/store-config";
import { InsufficientStockError, recordStockMovement } from "@/lib/inventory";

export { DELIVERY_FEE_CENTAVOS };

// Validates the checkout form (app/checkout/page.tsx) server-side — the
// client-side form has the same rules, but this is the one that's actually
// enforced (see app/api/orders/route.ts).
export const checkoutInputSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1, "Full name is required").max(200),
    email: z.string().trim().email("Enter a valid email"),
    phone: z
      .string()
      .trim()
      .min(7, "Enter a valid mobile number")
      .max(30),
    addressLine: z.string().trim().min(3, "Enter your house/unit no. and street").max(300),
    barangay: z.string().trim().min(1, "Barangay is required").max(150),
    city: z.string().trim().min(1, "City/municipality is required").max(150),
    province: z.string().trim().min(1, "Province is required").max(150),
    postalCode: z.string().trim().max(20).optional().or(z.literal("")),
    deliveryNotes: z.string().trim().max(500).optional().or(z.literal("")),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
      })
    )
    .min(1, "Your cart is empty"),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

export class OrderCreationError extends Error {}

/**
 * Creates a PENDING order from cart line items, re-pricing and re-checking
 * stock server-side (never trusting client-supplied prices or product
 * availability).
 */
export async function createOrderFromCart(input: CheckoutInput) {
  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productById = new Map(products.map((p) => [p.id, p]));

  let subtotalCentavos = 0;
  const orderItemsData = input.items.map((item) => {
    const product = productById.get(item.productId);
    if (!product) throw new OrderCreationError(`One of the items in your cart is no longer available`);
    if (product.status !== "ACTIVE") {
      throw new OrderCreationError(`"${product.name}" is currently unavailable`);
    }
    if (product.stock < item.quantity) {
      throw new OrderCreationError(`Not enough stock for "${product.name}" (${product.stock} left)`);
    }
    const unitPrice = effectivePrice(product);
    const lineSubtotal = unitPrice * item.quantity;
    subtotalCentavos += lineSubtotal;
    return {
      productId: product.id,
      productName: product.name,
      unitPriceCentavos: unitPrice,
      unitCostCentavos: product.costCentavos,
      quantity: item.quantity,
      subtotalCentavos: lineSubtotal,
    };
  });

  const deliveryFeeCentavos = DELIVERY_FEE_CENTAVOS;
  const discountCentavos = 0;
  const totalCentavos = subtotalCentavos + deliveryFeeCentavos - discountCentavos;

  const order = await prisma.order.create({
    data: {
      customerName: input.customer.name,
      email: input.customer.email,
      phone: input.customer.phone,
      addressLine: input.customer.addressLine,
      barangay: input.customer.barangay,
      city: input.customer.city,
      province: input.customer.province,
      postalCode: input.customer.postalCode || null,
      deliveryNotes: input.customer.deliveryNotes || null,
      subtotalCentavos,
      deliveryFeeCentavos,
      discountCentavos,
      totalCentavos,
      orderStatus: "PENDING",
      paymentStatus: "PENDING",
      items: { create: orderItemsData },
    },
    include: { items: true },
  });

  return order;
}

/** Fetches one order with its line items — used by order-detail pages/APIs and the checkout status poller. */
export async function getOrderById(id: string) {
  return prisma.order.findUnique({ where: { id }, include: { items: true } });
}

/** Looks up the order tied to a given PayMongo Payment Intent — used by the webhook handler to know which order to update. */
export async function getOrderByPaymentIntentId(paymentIntentId: string) {
  return prisma.order.findUnique({ where: { paymentIntentId }, include: { items: true } });
}

export type ListOrdersFilters = {
  search?: string;
  orderStatus?: string;
  paymentStatus?: string;
};

/** Order list for the admin Orders page, with optional search/status filters. */
export async function listOrders(filters: ListOrdersFilters = {}) {
  return prisma.order.findMany({
    where: {
      ...(filters.orderStatus ? { orderStatus: filters.orderStatus as never } : {}),
      ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus as never } : {}),
      ...(filters.search
        ? {
            OR: [
              { customerName: { contains: filters.search, mode: "insensitive" } },
              { email: { contains: filters.search, mode: "insensitive" } },
              { phone: { contains: filters.search } },
              { id: { contains: filters.search } },
            ],
          }
        : {}),
    },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Records the PayMongo Payment Intent an order is now attempting payment through, and marks it PROCESSING. */
export async function attachPaymentIntentToOrder(
  orderId: string,
  data: { paymentIntentId: string; paymentMethod: string; isMockPayment: boolean }
) {
  return prisma.order.update({
    where: { id: orderId },
    data: { ...data, paymentStatus: "PROCESSING" },
  });
}

/**
 * Marks an order's payment PAID and decrements product stock, and advances
 * a still-PENDING order to CONFIRMED. Idempotent — safe to call more than
 * once for the same order (e.g. webhook retries, or both the webhook and
 * the return-page fallback poll firing for the same event).
 *
 * Online orders only reserve stock at *this* point (payment confirmation),
 * not at order creation — so it's possible, in a genuine race between two
 * customers checking out the last unit, for PayMongo to have already
 * captured payment before we discover here that the item sold out (e.g.
 * via the POS) in the meantime. We can't safely auto-refund via PayMongo
 * from here, so that case is surfaced rather than silently dropped: the
 * order is cancelled with an internal note flagging it for manual refund
 * review, and stock is never allowed to go negative.
 */
export async function markOrderPaid(orderId: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.paymentStatus === "PAID") return;

    try {
      for (const item of order.items) {
        if (!item.productId) continue;
        await recordStockMovement(tx, {
          productId: item.productId,
          quantityChange: -item.quantity,
          type: "ONLINE_SALE",
          orderId: order.id,
        });
      }
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: "PAID",
            orderStatus: "CANCELLED",
            internalNotes: `⚠️ STOCK CONFLICT: payment was captured but "${err.productName}" sold out before fulfillment (${err.available} left, ${err.requested} needed). Needs manual refund review.`,
          },
        });
        return;
      }
      throw err;
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "PAID",
        orderStatus: order.orderStatus === "PENDING" ? "CONFIRMED" : order.orderStatus,
      },
    });
  });
}

/** Marks an order's payment FAILED. Does nothing if payment already succeeded. */
export async function markOrderPaymentFailed(orderId: string) {
  await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: { not: "PAID" } },
    data: { paymentStatus: "FAILED" },
  });
}

/**
 * Records a cash-on-delivery or bank-transfer order — no payment gateway
 * involved. Payment status stays PENDING (COD: collected on delivery; bank
 * transfer: awaiting manual staff verification) until staff confirm funds
 * were actually received via the admin order screen.
 */
export async function attachOfflinePaymentMethod(orderId: string, method: "cod" | "bank_transfer") {
  return prisma.order.update({
    where: { id: orderId },
    data: { paymentMethod: method, isMockPayment: false, orderStatus: "CONFIRMED" },
  });
}
