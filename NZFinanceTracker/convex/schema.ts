import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const frequency = v.union(v.literal("weekly"), v.literal("fortnightly"), v.literal("monthly"));

export default defineSchema({
  ...authTables,

  expenses: defineTable({
    userId: v.id("users"),
    description: v.string(),
    amount: v.number(),
    category: v.string(),
    date: v.string(), // ISO "yyyy-MM-dd"
    notes: v.string(),
    createdAt: v.string(), // ISO datetime
    isSample: v.optional(v.boolean()),
  })
    .index("by_user_and_date", ["userId", "date"])
    .index("by_date", ["date"]),

  budgets: defineTable({
    userId: v.id("users"),
    // Default budgets — used to prefill each period's input; any period can be overridden
    // with its own row in `periodBudgets`.
    weekly: v.union(v.number(), v.null()),
    monthly: v.union(v.number(), v.null()),
    // Fixed automatic savings carved out of each period's budget (the effective spending
    // limit is budget − this). What actually lands in savings for a period is
    // min(this, budget − spent); see computePeriodSavingsImpact in src/utils/periodBudget.ts.
    savingsWeekly: v.union(v.number(), v.null()),
    savingsMonthly: v.union(v.number(), v.null()),
    startingBalance: v.union(v.number(), v.null()),
    income: v.union(
      v.object({
        amount: v.number(),
        frequency,
        nextPayDate: v.string(), // ISO "yyyy-MM-dd"
      }),
      v.null(),
    ),
  }).index("by_user", ["userId"]),

  // One row per period the user has given an explicit budget for. Absence of a row means the
  // period falls back to the matching default in `budgets`.
  periodBudgets: defineTable({
    userId: v.id("users"),
    period: v.union(v.literal("weekly"), v.literal("monthly")),
    periodStart: v.string(), // ISO "yyyy-MM-dd" — Monday for weekly, the 1st for monthly
    amount: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_period", ["userId", "period", "periodStart"]),

  recurringExpenses: defineTable({
    userId: v.id("users"),
    description: v.string(),
    amount: v.number(),
    category: v.string(),
    frequency,
    nextDueDate: v.string(), // ISO "yyyy-MM-dd"
    active: v.boolean(),
  }).index("by_user", ["userId"]),

  savingsEntries: defineTable({
    userId: v.id("users"),
    /** Positive = money put into savings, negative = money taken out. */
    amount: v.number(),
    date: v.string(), // ISO "yyyy-MM-dd"
    note: v.string(),
    /** How the entry got here: a hand-recorded deposit/withdrawal, or an auto goal contribution. */
    source: v.union(
      v.literal("manual"),
      v.literal("auto-weekly"),
      v.literal("auto-monthly"),
    ),
    createdAt: v.string(), // ISO datetime
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "date"]),

  meta: defineTable({
    userId: v.id("users"),
    sampleSeeded: v.boolean(),
  }).index("by_user", ["userId"]),

  notes: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("text"), v.literal("checklist")),
    title: v.string(),
    body: v.string(),
    checklistItems: v.array(v.object({ id: v.string(), text: v.string(), done: v.boolean() })),
    color: v.string(),
    audioStorageId: v.optional(v.id("_storage")),
    transcript: v.optional(v.string()),
    transcriptionStatus: v.union(
      v.literal("none"),
      v.literal("pending"),
      v.literal("done"),
      v.literal("failed"),
    ),
    scheduledDate: v.union(v.string(), v.null()), // ISO "yyyy-MM-dd"
    scheduledTime: v.union(v.string(), v.null()), // "HH:mm"
    reminderEnabled: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "scheduledDate"]),
});
