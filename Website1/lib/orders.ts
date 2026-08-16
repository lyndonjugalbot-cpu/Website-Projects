import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const checkoutInputSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1, "Name is required").max(200),
    email: z.string().trim().email("Enter a valid email"),
    phone: z.string().trim().min(7, "Enter a valid phone number").max(30),
    address: z.string().trim().min(5, "Enter a delivery address").max(500),
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
 * stock server-side (never trusting client-supplied prices).
 */
export async function createOrderFromCart(input: CheckoutInput) {
  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productById = new Map(products.map((p) => [p.id, p]));

  let subtotalCentavos = 0;
  const orderItemsData = input.items.map((item) => {
    const product = productById.get(item.productId);
    if (!product) throw new OrderCreationError(`Product ${item.productId} no longer exists`);
    if (product.stock < item.quantity) {
      throw new OrderCreationError(`Not enough stock for "${product.name}" (${product.stock} left)`);
    }
    const lineSubtotal = product.priceCentavos * item.quantity;
    subtotalCentavos += lineSubtotal;
    return {
      productId: product.id,
      productName: product.name,
      unitPriceCentavos: product.priceCentavos,
      quantity: item.quantity,
      subtotalCentavos: lineSubtotal,
    };
  });

  // No shipping fee or tax calculation in this demo — total mirrors subtotal.
  const totalCentavos = subtotalCentavos;

  const order = await prisma.order.create({
    data: {
      customerName: input.customer.name,
      email: input.customer.email,
      phone: input.customer.phone,
      address: input.customer.address,
      subtotalCentavos,
      totalCentavos,
      status: "PENDING",
      items: { create: orderItemsData },
    },
    include: { items: true },
  });

  return order;
}

export async function getOrderById(id: string) {
  return prisma.order.findUnique({ where: { id }, include: { items: true } });
}

export async function getOrderByPaymentIntentId(paymentIntentId: string) {
  return prisma.order.findUnique({ where: { paymentIntentId }, include: { items: true } });
}

export async function listOrders() {
  return prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function attachPaymentIntentToOrder(
  orderId: string,
  data: { paymentIntentId: string; paymentMethod: string; isMockPayment: boolean }
) {
  return prisma.order.update({ where: { id: orderId }, data });
}

/**
 * Marks an order PAID and decrements product stock. Idempotent — safe to
 * call more than once for the same order (e.g. webhook retries, or both the
 * webhook and the return-page fallback poll firing for the same event).
 */
export async function markOrderPaid(orderId: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.status === "PAID") return;

    for (const item of order.items) {
      if (!item.productId) continue;
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    await tx.order.update({ where: { id: orderId }, data: { status: "PAID" } });
  });
}

/** Marks an order FAILED. Does nothing if the order is already PAID. */
export async function markOrderFailed(orderId: string) {
  await prisma.order.updateMany({
    where: { id: orderId, status: { not: "PAID" } },
    data: { status: "FAILED" },
  });
}
