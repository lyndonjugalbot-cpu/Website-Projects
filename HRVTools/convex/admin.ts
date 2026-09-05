import { createAccount } from "@convex-dev/auth/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

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
