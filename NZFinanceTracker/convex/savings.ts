import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const entries = await ctx.db
      .query("savingsEntries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return entries.sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  },
});

export const add = mutation({
  args: { amount: v.number(), date: v.string(), note: v.string() },
  handler: async (ctx, { amount, date, note }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const rounded = Math.round(amount * 100) / 100;
    if (!Number.isFinite(rounded) || rounded === 0) throw new Error("Amount must be non-zero");
    await ctx.db.insert("savingsEntries", {
      userId,
      amount: rounded,
      date,
      note: note.trim(),
      source: "manual",
      createdAt: new Date().toISOString(),
    });
  },
});

export const update = mutation({
  args: { id: v.id("savingsEntries"), amount: v.number(), date: v.string(), note: v.string() },
  handler: async (ctx, { id, amount, date, note }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    const rounded = Math.round(amount * 100) / 100;
    if (!Number.isFinite(rounded) || rounded === 0) throw new Error("Amount must be non-zero");
    await ctx.db.patch(id, { amount: rounded, date, note: note.trim() });
  },
});

export const remove = mutation({
  args: { id: v.id("savingsEntries") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});

/**
 * Automatic savings are now derived on the client each period from the budget
 * that was entered and what was actually spent (see computePeriodSavingsImpact
 * in src/utils/periodBudget.ts) rather than materialised as rows. This job
 * clears any `auto-weekly` / `auto-monthly` entries left over from the old
 * accrual scheme so they don't double-count. Idempotent.
 */
export const reconcileLegacyAutoEntries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const legacy = await ctx.db
      .query("savingsEntries")
      .filter((q) =>
        q.or(
          q.eq(q.field("source"), "auto-weekly"),
          q.eq(q.field("source"), "auto-monthly"),
        ),
      )
      .collect();
    await Promise.all(legacy.map((entry) => ctx.db.delete(entry._id)));
  },
});
