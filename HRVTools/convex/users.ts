import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
import { requireAdmin } from "./authHelpers";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

export const listEmployees = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const employees = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "employee"))
      .collect();
    return employees.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  },
});

export const getEmployee = query({
  args: { employeeId: v.id("users") },
  handler: async (ctx, { employeeId }) => {
    await requireAdmin(ctx);
    return await ctx.db.get(employeeId);
  },
});

export const internalGetUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => ctx.db.get(userId),
});
