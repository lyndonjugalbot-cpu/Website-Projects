import { createAccount } from "@convex-dev/auth/server";
import { action } from "./_generated/server";

/**
 * Creates the five agent (employee) accounts: Gihan, Roddi, Lezle, Abbie, Kylie.
 * Run once via `npx convex run seed:createAgents`.
 * Idempotent — agents that already exist are reported as "exists" and skipped.
 */
export const createAgents = action({
  args: {},
  handler: async (ctx) => {
    const agents = [
      { name: "Gihan", email: "gihan@hrvtools.app" },
      { name: "Roddi", email: "roddi@hrvtools.app" },
      { name: "Lezle", email: "lezle@hrvtools.app" },
      { name: "Abbie", email: "abbie@hrvtools.app" },
      { name: "Kylie", email: "kylie@hrvtools.app" },
    ];
    const password = "Agent123!";

    const results: { name: string; email: string; status: "created" | "exists" }[] = [];
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
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
        results.push({ name: agent.name, email: agent.email, status: "created" });
      } catch {
        results.push({ name: agent.name, email: agent.email, status: "exists" });
      }
    }

    return { password, results };
  },
});

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
