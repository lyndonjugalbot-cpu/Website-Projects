import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await requireUser(ctx);
  if (user.role !== "admin") throw new Error("Admins only");
  return user;
}

export async function requireSelfOrAdmin(ctx: QueryCtx | MutationCtx, employeeId: Id<"users">) {
  const user = await requireUser(ctx);
  if (user.role !== "admin" && user._id !== employeeId) {
    throw new Error("Not authorized");
  }
  return user;
}
