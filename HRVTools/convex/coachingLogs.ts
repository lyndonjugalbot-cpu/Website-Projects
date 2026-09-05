import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireSelfOrAdmin } from "./authHelpers";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    employeeId: v.id("users"),
    date: v.string(),
    coachingOpportunities: v.string(),
    actionPlan: v.string(),
    notes: v.optional(v.string()),
    recordingStorageId: v.optional(v.id("_storage")),
    recordingFileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    return await ctx.db.insert("coachingLogs", {
      ...args,
      createdBy: admin._id,
      createdAt: new Date().toISOString(),
    });
  },
});

export const listForEmployee = query({
  args: { employeeId: v.id("users") },
  handler: async (ctx, { employeeId }) => {
    await requireSelfOrAdmin(ctx, employeeId);
    const logs = await ctx.db
      .query("coachingLogs")
      .withIndex("by_employee_and_date", (q) => q.eq("employeeId", employeeId))
      .order("desc")
      .collect();
    return await Promise.all(
      logs.map(async (log) => ({
        ...log,
        recordingUrl: log.recordingStorageId ? await ctx.storage.getUrl(log.recordingStorageId) : null,
      })),
    );
  },
});

export const remove = mutation({
  args: { logId: v.id("coachingLogs") },
  handler: async (ctx, { logId }) => {
    await requireAdmin(ctx);
    const log = await ctx.db.get(logId);
    if (!log) return;
    if (log.recordingStorageId) {
      await ctx.storage.delete(log.recordingStorageId);
    }
    await ctx.db.delete(logId);
  },
});
