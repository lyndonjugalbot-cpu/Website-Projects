import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const frequency = v.union(v.literal("weekly"), v.literal("fortnightly"), v.literal("monthly"));

export default defineSchema({
  ...authTables,

  expenses: defineTable({
    // Optional during the auth migration; backfilled via migrations.ts then tightened to required.
    userId: v.optional(v.id("users")),
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
    userId: v.optional(v.id("users")),
    weekly: v.union(v.number(), v.null()),
    monthly: v.union(v.number(), v.null()),
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

  recurringExpenses: defineTable({
    userId: v.id("users"),
    description: v.string(),
    amount: v.number(),
    category: v.string(),
    frequency,
    nextDueDate: v.string(), // ISO "yyyy-MM-dd"
    active: v.boolean(),
  }).index("by_user", ["userId"]),

  meta: defineTable({
    userId: v.optional(v.id("users")),
    sampleSeeded: v.boolean(),
  }).index("by_user", ["userId"]),
});
