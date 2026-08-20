import { subMonths } from "date-fns";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { DATA_RETENTION_MONTHS } from "./constants";

function retentionCutoffISO(): string {
  return subMonths(new Date(), DATA_RETENTION_MONTHS).toISOString().slice(0, 10);
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = retentionCutoffISO();
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_date", (q) => q.gte("date", cutoff))
      .collect();
    return expenses.sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  },
});

const expenseFields = {
  description: v.string(),
  amount: v.number(),
  category: v.string(),
  date: v.string(),
  notes: v.string(),
};

export const add = mutation({
  args: expenseFields,
  handler: async (ctx, args) => {
    await ctx.db.insert("expenses", { ...args, createdAt: new Date().toISOString() });
  },
});

export const update = mutation({
  args: { id: v.id("expenses"), ...expenseFields },
  handler: async (ctx, { id, ...patch }) => {
    await ctx.db.patch(id, { ...patch, isSample: false });
  },
});

export const remove = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const [expenses, budgetDocs] = await Promise.all([
      ctx.db.query("expenses").collect(),
      ctx.db.query("budgets").collect(),
    ]);
    await Promise.all([
      ...expenses.map((e) => ctx.db.delete(e._id)),
      ...budgetDocs.map((b) => ctx.db.delete(b._id)),
    ]);
  },
});

export const importMany = mutation({
  args: {
    expenses: v.array(
      v.object({
        ...expenseFields,
        createdAt: v.string(),
      }),
    ),
  },
  handler: async (ctx, { expenses }) => {
    const cutoff = retentionCutoffISO();
    const today = new Date().toISOString().slice(0, 10);
    let importedCount = 0;
    for (const expense of expenses) {
      if (expense.date < cutoff || expense.date > today || expense.amount <= 0 || !expense.description.trim()) {
        continue;
      }
      await ctx.db.insert("expenses", expense);
      importedCount += 1;
    }
    return importedCount;
  },
});

export const seedSampleIfEmpty = mutation({
  args: {},
  handler: async (ctx) => {
    const existingMeta = await ctx.db.query("meta").first();
    if (existingMeta?.sampleSeeded) return;

    const existingExpenses = await ctx.db.query("expenses").first();
    if (existingExpenses) {
      if (existingMeta) {
        await ctx.db.patch(existingMeta._id, { sampleSeeded: true });
      } else {
        await ctx.db.insert("meta", { sampleSeeded: true });
      }
      return;
    }

    const now = new Date();
    const isoDaysAgo = (days: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      return d.toISOString().slice(0, 10);
    };
    const createdAt = now.toISOString();

    const samples = [
      { description: "Countdown weekly shop", amount: 128.45, category: "Groceries", notes: "Bought at the supermarket", daysAgo: 1 },
      { description: "Bus fare - AT HOP", amount: 12.5, category: "Transport", notes: "", daysAgo: 2 },
      { description: "Lunch at cafe", amount: 18.9, category: "Eating out", notes: "Flat white and toastie", daysAgo: 3 },
      { description: "Power bill", amount: 145.0, category: "Utilities", notes: "Monthly electricity", daysAgo: 6 },
      { description: "Movie tickets", amount: 42.0, category: "Entertainment", notes: "Weekend movie with friends", daysAgo: 9 },
    ];

    for (const sample of samples) {
      await ctx.db.insert("expenses", {
        description: sample.description,
        amount: sample.amount,
        category: sample.category,
        date: isoDaysAgo(sample.daysAgo),
        notes: sample.notes,
        createdAt,
        isSample: true,
      });
    }

    if (existingMeta) {
      await ctx.db.patch(existingMeta._id, { sampleSeeded: true });
    } else {
      await ctx.db.insert("meta", { sampleSeeded: true });
    }
  },
});

export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = retentionCutoffISO();
    const expired = await ctx.db
      .query("expenses")
      .withIndex("by_date", (q) => q.lt("date", cutoff))
      .collect();
    await Promise.all(expired.map((e) => ctx.db.delete(e._id)));
  },
});
