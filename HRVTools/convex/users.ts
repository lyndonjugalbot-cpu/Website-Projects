import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireAdmin, requireUser } from "./authHelpers";

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

export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, { userId, name, phone, address }) => {
    const caller = await requireUser(ctx);
    if (caller._id !== userId) {
      throw new Error("You can only edit your own profile");
    }

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Full name is required");

    await ctx.db.patch(userId, {
      name: trimmedName,
      phone: phone?.trim() ? phone.trim() : undefined,
      address: address?.trim() ? address.trim() : undefined,
    });
  },
});

export const internalGetUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => ctx.db.get(userId),
});
