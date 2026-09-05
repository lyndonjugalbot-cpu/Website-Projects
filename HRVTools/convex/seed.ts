import { createAccount } from "@convex-dev/auth/server";
import { action } from "./_generated/server";

/**
 * One-time setup: creates the default admin account.
 * Run once via `npx convex run seed:createDefaultAdmin` after the first deploy.
 * Safe to run only once — it errors if the account already exists.
 */
export const createDefaultAdmin = action({
  args: {},
  handler: async (ctx) => {
    const email = "torilla.abigail@gmail.com";
    const result = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: "Admin123!" },
      profile: {
        email,
        name: "Torilla Abigail",
        role: "admin" as const,
        active: true,
      },
    });
    return { userId: result.user._id };
  },
});
