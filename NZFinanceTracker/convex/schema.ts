import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  expenses: defineTable({
    description: v.string(),
    amount: v.number(),
    category: v.string(),
    date: v.string(), // ISO "yyyy-MM-dd"
    notes: v.string(),
    createdAt: v.string(), // ISO datetime
    isSample: v.optional(v.boolean()),
  }).index("by_date", ["date"]),

  budgets: defineTable({
    weekly: v.union(v.number(), v.null()),
    monthly: v.union(v.number(), v.null()),
  }),

  meta: defineTable({
    sampleSeeded: v.boolean(),
  }),
});
