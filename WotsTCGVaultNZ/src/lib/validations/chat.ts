import { z } from "zod";

export const chatMessageSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(2000),
});
