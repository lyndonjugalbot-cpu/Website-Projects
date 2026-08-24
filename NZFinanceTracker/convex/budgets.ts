import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const emptySettings = {
  weekly: null,
  monthly: null,
  savingsWeekly: null,
  savingsMonthly: null,
  startingBalance: null,
  income: null,
};

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return emptySettings;
    const doc = await ctx.db
      .query("budgets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return {
      weekly: doc?.weekly ?? null,
      monthly: doc?.monthly ?? null,
      savingsWeekly: doc?.savingsWeekly ?? null,
      savingsMonthly: doc?.savingsMonthly ?? null,
      startingBalance: doc?.startingBalance ?? null,
      income: doc?.income ?? null,
    };
  },
});

const frequency = v.union(v.literal("weekly"), v.literal("fortnightly"), v.literal("monthly"));

export const set = mutation({
  args: {
    weekly: v.union(v.number(), v.null()),
    monthly: v.union(v.number(), v.null()),
    savingsWeekly: v.union(v.number(), v.null()),
    savingsMonthly: v.union(v.number(), v.null()),
    startingBalance: v.union(v.number(), v.null()),
    income: v.union(
      v.object({ amount: v.number(), frequency, nextPayDate: v.string() }),
      v.null(),
    ),
  },
  handler: async (ctx, settings) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("budgets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, settings);
    } else {
      await ctx.db.insert("budgets", { userId, ...settings });
    }
  },
});
