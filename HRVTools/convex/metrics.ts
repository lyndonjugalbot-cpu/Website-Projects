import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireSelfOrAdmin } from "./authHelpers";

export const record = mutation({
  args: {
    employeeId: v.id("users"),
    weekStart: v.string(),
    metricName: v.string(),
    value: v.number(),
  },
  handler: async (ctx, args) => {
    // Agents record their own stats; admins can record for anyone.
    const author = await requireSelfOrAdmin(ctx, args.employeeId);
    const metricName = args.metricName.trim();
    if (!metricName) throw new Error("Metric name is required");

    const existing = await ctx.db
      .query("metrics")
      .withIndex("by_employee_week_metric", (q) =>
        q.eq("employeeId", args.employeeId).eq("weekStart", args.weekStart).eq("metricName", metricName),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        createdBy: author._id,
        createdAt: new Date().toISOString(),
      });
      return existing._id;
    }

    return await ctx.db.insert("metrics", {
      employeeId: args.employeeId,
      weekStart: args.weekStart,
      metricName,
      value: args.value,
      createdBy: author._id,
      createdAt: new Date().toISOString(),
    });
  },
});

export const listForEmployee = query({
  args: { employeeId: v.id("users") },
  handler: async (ctx, { employeeId }) => {
    await requireSelfOrAdmin(ctx, employeeId);
    const rows = await ctx.db
      .query("metrics")
      .withIndex("by_employee", (q) => q.eq("employeeId", employeeId))
      .collect();
    return rows.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  },
});

export const remove = mutation({
  args: { metricId: v.id("metrics") },
  handler: async (ctx, { metricId }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(metricId);
  },
});
