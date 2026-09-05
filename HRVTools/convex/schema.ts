import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // Extends the auth-provided `users` table with HRV profile fields.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(v.union(v.literal("admin"), v.literal("employee"))),
    idNumber: v.optional(v.string()),
    active: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_role", ["role"]),

  coachingLogs: defineTable({
    employeeId: v.id("users"),
    date: v.string(), // ISO "yyyy-MM-dd"
    coachingOpportunities: v.string(),
    actionPlan: v.string(),
    notes: v.optional(v.string()),
    recordingStorageId: v.optional(v.id("_storage")),
    recordingFileName: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.string(), // ISO datetime
  })
    .index("by_employee", ["employeeId"])
    .index("by_employee_and_date", ["employeeId", "date"]),

  metrics: defineTable({
    employeeId: v.id("users"),
    weekStart: v.string(), // ISO "yyyy-MM-dd", Monday of the week
    metricName: v.string(),
    value: v.number(),
    createdBy: v.id("users"),
    createdAt: v.string(), // ISO datetime
  })
    .index("by_employee", ["employeeId"])
    .index("by_employee_week_metric", ["employeeId", "weekStart", "metricName"]),
});
