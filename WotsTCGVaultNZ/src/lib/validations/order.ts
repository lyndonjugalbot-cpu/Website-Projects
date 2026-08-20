import { z } from "zod";

export const checkoutSchema = z.object({
  listingId: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  shippingOptionId: z.string().min(1),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const trackingSchema = z.object({
  carrier: z.string().min(1),
  trackingNumber: z.string().min(1),
  trackingUrl: z.string().url().optional().or(z.literal("")),
  hasInsurance: z.boolean().default(false),
});

export const reviewSchema = z.object({
  orderId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const reportSchema = z.object({
  reportedUserId: z.string().optional(),
  listingId: z.string().optional(),
  reason: z.enum([
    "COUNTERFEIT",
    "FRAUD",
    "PROHIBITED_ITEM",
    "MISLEADING_LISTING",
    "HARASSMENT",
    "SPAM",
    "PAYMENT_BYPASS_ATTEMPT",
    "OTHER",
  ]),
  details: z.string().min(10).max(2000),
});

export const messageSchema = z.object({
  recipientId: z.string().min(1),
  listingId: z.string().optional(),
  body: z.string().min(1).max(2000),
});
