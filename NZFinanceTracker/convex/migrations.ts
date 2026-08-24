import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * One-off: claims pre-auth data (created before accounts existed) for a user.
 * Find your user id with `npx convex run migrations:listUsers`, then run
 * `npx convex run migrations:backfillUserId '{"userId":"<id>"}'`.
 * Once every user has a userId, this file (and the optional userId fields in
 * schema.ts) can be removed.
 */
export const backfillUserId = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const [expenses, budgetDocs, metaDocs] = await Promise.all([
      ctx.db.query("expenses").collect(),
      ctx.db.query("budgets").collect(),
      ctx.db.query("meta").collect(),
    ]);
    let claimed = 0;
    for (const doc of [...expenses, ...budgetDocs, ...metaDocs]) {
      if (doc.userId === undefined) {
        await ctx.db.patch(doc._id, { userId });
        claimed += 1;
      }
    }
    return { claimed };
  },
});

export const listUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({ id: u._id, email: u.email }));
  },
});
