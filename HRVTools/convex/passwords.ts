import { getAuthUserId, modifyAccountCredentials, retrieveAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const MIN_LENGTH = 8;

/** Any signed-in user changes their own password (verifies the current one). */
export const changeMyPassword = action({
  args: { currentPassword: v.string(), newPassword: v.string() },
  handler: async (ctx, { currentPassword, newPassword }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.runQuery(internal.users.internalGetUser, { userId });
    if (!user?.email) throw new Error("Your account has no email on file");
    if (newPassword.length < MIN_LENGTH) {
      throw new Error(`New password must be at least ${MIN_LENGTH} characters`);
    }
    if (newPassword === currentPassword) {
      throw new Error("New password must be different from the current one");
    }

    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: user.email, secret: currentPassword },
      });
    } catch {
      throw new Error("Current password is incorrect");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: user.email, secret: newPassword },
    });
    return { ok: true };
  },
});
