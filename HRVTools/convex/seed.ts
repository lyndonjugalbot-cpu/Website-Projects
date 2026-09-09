import { createAccount, getAuthUserId } from "@convex-dev/auth/server";
import { action, mutation } from "./_generated/server";

/**
 * One-time setup: creates the HRVTool_Admin account.
 * Run once via `npx convex run seed:createAdmin` after the first deploy.
 * Errors if the account already exists. Change the password after first sign-in
 * from the app (Shell → Change password).
 */
export const createAdmin = action({
  args: {},
  handler: async (ctx) => {
    const email = "hrvtool_admin@hrvtools.app";
    const password = "HrvAdmin123!";
    const result = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: password },
      profile: {
        email,
        name: "HRVTool_Admin",
        role: "admin" as const,
        active: true,
      },
    });
    return { userId: result.user._id, email, password };
  },
});

// Seeded placeholder accounts that should be removed once real accounts exist.
const DUMMY_EMAILS = [
  "torilla.abigail@gmail.com",
  "gihan@hrvtools.app",
  "roddi@hrvtools.app",
  "lezle@hrvtools.app",
  "abbie@hrvtools.app",
  "kylie@hrvtools.app",
];

/**
 * Deletes the seeded placeholder accounts (old default admin + the five dummy
 * agents) along with their logins, sessions, coaching logs and metrics.
 * Run as a signed-in admin via `npx convex run seed:removeDummyAccounts`.
 * The currently signed-in account is skipped. Idempotent.
 */
export const removeDummyAccounts = mutation({
  args: {},
  handler: async (ctx) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Not authenticated");
    const caller = await ctx.db.get(callerId);
    if (caller?.role !== "admin") throw new Error("Admins only");

    const removed: string[] = [];
    for (const email of DUMMY_EMAILS) {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .unique();
      if (!user || user._id === callerId) continue;

      const logs = await ctx.db
        .query("coachingLogs")
        .withIndex("by_employee", (q) => q.eq("employeeId", user._id))
        .collect();
      for (const log of logs) {
        if (log.recordingStorageId) await ctx.storage.delete(log.recordingStorageId);
        await ctx.db.delete(log._id);
      }

      const metrics = await ctx.db
        .query("metrics")
        .withIndex("by_employee", (q) => q.eq("employeeId", user._id))
        .collect();
      for (const metric of metrics) await ctx.db.delete(metric._id);

      const accounts = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
        .collect();
      for (const account of accounts) await ctx.db.delete(account._id);

      const sessions = await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", user._id))
        .collect();
      for (const session of sessions) await ctx.db.delete(session._id);

      await ctx.db.delete(user._id);
      removed.push(email);
    }

    return { removed, skipped: DUMMY_EMAILS.filter((e) => !removed.includes(e)) };
  },
});
