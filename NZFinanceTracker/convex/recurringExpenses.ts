import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("recurringExpenses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

const frequency = v.union(v.literal("weekly"), v.literal("fortnightly"), v.literal("monthly"));

const recurringExpenseFields = {
  description: v.string(),
  amount: v.number(),
  category: v.string(),
  frequency,
  nextDueDate: v.string(),
};

export const add = mutation({
  args: recurringExpenseFields,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.insert("recurringExpenses", { ...args, userId, active: true });
  },
});

export const update = mutation({
  args: { id: v.id("recurringExpenses"), ...recurringExpenseFields },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, patch);
  },
});

export const toggleActive = mutation({
  args: { id: v.id("recurringExpenses"), active: v.boolean() },
  handler: async (ctx, { id, active }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { active });
  },
});

export const remove = mutation({
  args: { id: v.id("recurringExpenses") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});
