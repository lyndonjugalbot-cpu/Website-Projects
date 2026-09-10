import { getAuthUserId } from "@convex-dev/auth/server";
import { subMonths } from "date-fns";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const period = v.union(v.literal("weekly"), v.literal("monthly"));

/** Keep the working set bounded — the app only ever looks a few months back. */
function windowStartISO(): string {
  return subMonths(new Date(), 6).toISOString().slice(0, 10);
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const cutoff = windowStartISO();
    const rows = await ctx.db
      .query("periodBudgets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .filter((row) => row.periodStart >= cutoff)
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  },
});

/** Upsert a period's budget. An amount of 0 or less clears it (falls back to the default). */
export const set = mutation({
  args: { period, periodStart: v.string(), amount: v.number() },
  handler: async (ctx, { period, periodStart, amount }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("periodBudgets")
      .withIndex("by_user_and_period", (q) =>
        q.eq("userId", userId).eq("period", period).eq("periodStart", periodStart),
      )
      .first();

    const rounded = Math.round(amount * 100) / 100;
    if (!Number.isFinite(rounded) || rounded <= 0) {
      if (existing) await ctx.db.delete(existing._id);
      return;
    }

    if (existing) {
      await ctx.db.patch(existing._id, { amount: rounded });
    } else {
      await ctx.db.insert("periodBudgets", { userId, period, periodStart, amount: rounded });
    }
  },
});

export const remove = mutation({
  args: { id: v.id("periodBudgets") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});
