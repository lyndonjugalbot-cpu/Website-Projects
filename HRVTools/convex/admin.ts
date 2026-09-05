import { createAccount } from "@convex-dev/auth/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, mutation } from "./_generated/server";
import { requireAdmin } from "./authHelpers";

export const createEmployee = action({
  args: {
    name: v.string(),
    idNumber: v.string(),
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Not authenticated");
    const caller = await ctx.runQuery(internal.users.internalGetUser, { userId: callerId });
    if (!caller || caller.role !== "admin") {
      throw new Error("Only admins can add employees");
    }

    const email = args.email.trim().toLowerCase();
    const name = args.name.trim();
    const idNumber = args.idNumber.trim();
    if (!email || !name || !idNumber) {
      throw new Error("Name, ID number and email are required");
    }
    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const result = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: args.password },
      profile: {
        email,
        name,
        role: "employee" as const,
        idNumber,
        active: true,
      },
    });

    return { userId: result.user._id };
  },
});

export const deleteEmployee = mutation({
  args: { employeeId: v.id("users") },
  handler: async (ctx, { employeeId }) => {
    const admin = await requireAdmin(ctx);
    if (admin._id === employeeId) {
      throw new Error("You can't delete your own account");
    }
    const employee = await ctx.db.get(employeeId);
    if (!employee || employee.role !== "employee") {
      throw new Error("Employee not found");
    }

    const logs = await ctx.db
      .query("coachingLogs")
      .withIndex("by_employee", (q) => q.eq("employeeId", employeeId))
      .collect();
    for (const log of logs) {
      if (log.recordingStorageId) {
        await ctx.storage.delete(log.recordingStorageId);
      }
      await ctx.db.delete(log._id);
    }

    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_employee", (q) => q.eq("employeeId", employeeId))
      .collect();
    for (const metric of metrics) {
      await ctx.db.delete(metric._id);
    }

    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", employeeId))
      .collect();
    for (const account of accounts) {
      await ctx.db.delete(account._id);
    }

    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", employeeId))
      .collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    await ctx.db.delete(employeeId);
  },
});
