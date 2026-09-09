import { createAccount, modifyAccountCredentials } from "@convex-dev/auth/server";
import { internalAction, internalMutation } from "./_generated/server";

const ADMIN = {
  email: "hrvtool_admin@hrvtools.app",
  name: "HRVTool_Admin",
  password: "HrvAdmin123!",
};

const AGENTS = [
  { name: "Gihan", email: "gihan@hrvtools.app" },
  { name: "Roddi", email: "roddi@hrvtools.app" },
  { name: "Lezle", email: "lezle@hrvtools.app" },
  { name: "Abbie", email: "abbie@hrvtools.app" },
  { name: "Kylie", email: "kylie@hrvtools.app" },
];

// The only accounts that belong in the system.
const KEEP_EMAILS = [ADMIN.email, ...AGENTS.map((a) => a.email)];

function randomPassword(length = 14): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Creates the HRVTool_Admin account. Run once via
 * `npx convex run seed:createAdmin`. Errors if it already exists.
 * Change the password from the app (header → Change password) after first sign-in.
 */
export const createAdmin = internalAction({
  args: {},
  handler: async (ctx) => {
    const result = await createAccount(ctx, {
      provider: "password",
      account: { id: ADMIN.email, secret: ADMIN.password },
      profile: { email: ADMIN.email, name: ADMIN.name, role: "admin" as const, active: true },
    });
    return { userId: result.user._id, email: ADMIN.email, password: ADMIN.password };
  },
});

/**
 * Creates the five agent accounts (Gihan, Roddi, Lezle, Abbie, Kylie), each with
 * a fresh random password. Run via `npx convex run seed:createAgents`.
 * Idempotent — an agent that already exists just gets a new random password so
 * it stays testable. Returns the credentials to hand out.
 */
export const createAgents = internalAction({
  args: {},
  handler: async (ctx) => {
    const results: { name: string; email: string; password: string; status: string }[] = [];
    for (let i = 0; i < AGENTS.length; i++) {
      const agent = AGENTS[i];
      const password = randomPassword();
      try {
        await createAccount(ctx, {
          provider: "password",
          account: { id: agent.email, secret: password },
          profile: {
            email: agent.email,
            name: agent.name,
            role: "employee" as const,
            idNumber: `AGENT-${String(i + 1).padStart(2, "0")}`,
            active: true,
          },
        });
        results.push({ ...agent, password, status: "created" });
      } catch {
        await modifyAccountCredentials(ctx, {
          provider: "password",
          account: { id: agent.email, secret: password },
        });
        results.push({ ...agent, password, status: "password reset" });
      }
    }
    return results;
  },
});

/**
 * Deletes every account that isn't HRVTool_Admin or one of the five agents,
 * along with its login, sessions, coaching logs and metrics.
 * Run via `npx convex run seed:purgeNonCanonicalAccounts`.
 */
export const purgeNonCanonicalAccounts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const removed: { name?: string; email?: string }[] = [];

    for (const user of users) {
      if (user.email && KEEP_EMAILS.includes(user.email)) continue;

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
      removed.push({ name: user.name, email: user.email });
    }

    return { removed, kept: KEEP_EMAILS };
  },
});
