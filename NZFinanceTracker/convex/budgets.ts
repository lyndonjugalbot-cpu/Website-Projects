import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db.query("budgets").first();
    return { weekly: doc?.weekly ?? null, monthly: doc?.monthly ?? null };
  },
});

export const set = mutation({
  args: { weekly: v.union(v.number(), v.null()), monthly: v.union(v.number(), v.null()) },
  handler: async (ctx, { weekly, monthly }) => {
    const existing = await ctx.db.query("budgets").first();
    if (existing) {
      await ctx.db.patch(existing._id, { weekly, monthly });
    } else {
      await ctx.db.insert("budgets", { weekly, monthly });
    }
  },
});
