import { getAuthUserId } from "@convex-dev/auth/server";
import {
  addMonths,
  addWeeks,
  format,
  max as maxDate,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

/** Monday-start weeks, to match the rest of the app. */
const WEEK_OPTS = { weekStartsOn: 1 as const };

/**
 * How far back the accrual job will fill in missed auto-contributions. Kept
 * small so setting a savings goal doesn't retroactively invent months of
 * savings — it only covers a realistic gap in scheduled runs.
 */
const WEEKLY_BACKFILL_WEEKS = 3;
const MONTHLY_BACKFILL_MONTHS = 1;

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
 * Drops one auto savings entry per period for every user whose budget carries a
 * savings goal. Runs on a schedule; idempotent (skips periods that already have
 * an auto entry) and backfills a bounded number of missed periods so a gap in
 * cron runs doesn't permanently lose contributions.
 */
export const accrueScheduled = internalMutation({
  args: {},
  handler: async (ctx) => {
    const budgets = await ctx.db.query("budgets").collect();
    const now = new Date();
    const nowISO = now.toISOString();

    for (const budget of budgets) {
      const weeklyGoal = budget.savingsWeekly ?? 0;
      const monthlyGoal = budget.savingsMonthly ?? 0;
      if (weeklyGoal <= 0 && monthlyGoal <= 0) continue;

      const existing = await ctx.db
        .query("savingsEntries")
        .withIndex("by_user", (q) => q.eq("userId", budget.userId))
        .collect();
      const weeklyDates = new Set(
        existing.filter((e) => e.source === "auto-weekly").map((e) => e.date),
      );
      const monthlyDates = new Set(
        existing.filter((e) => e.source === "auto-monthly").map((e) => e.date),
      );

      const budgetCreatedAt = new Date(budget._creationTime);

      if (weeklyGoal > 0) {
        const first = startOfWeek(maxDate([budgetCreatedAt, subWeeks(now, WEEKLY_BACKFILL_WEEKS)]), WEEK_OPTS);
        const current = startOfWeek(now, WEEK_OPTS).getTime();
        for (let d = first; d.getTime() <= current; d = addWeeks(d, 1)) {
          const iso = format(d, "yyyy-MM-dd");
          if (weeklyDates.has(iso)) continue;
          await ctx.db.insert("savingsEntries", {
            userId: budget.userId,
            amount: weeklyGoal,
            date: iso,
            note: "Weekly savings goal",
            source: "auto-weekly",
            createdAt: nowISO,
          });
        }
      }

      if (monthlyGoal > 0) {
        const first = startOfMonth(maxDate([budgetCreatedAt, subMonths(now, MONTHLY_BACKFILL_MONTHS)]));
        const current = startOfMonth(now).getTime();
        for (let d = first; d.getTime() <= current; d = addMonths(d, 1)) {
          const iso = format(d, "yyyy-MM-dd");
          if (monthlyDates.has(iso)) continue;
          await ctx.db.insert("savingsEntries", {
            userId: budget.userId,
            amount: monthlyGoal,
            date: iso,
            note: "Monthly savings goal",
            source: "auto-monthly",
            createdAt: nowISO,
          });
        }
      }
    }
  },
});
