// Called at the top of every /api/admin/* route handler to enforce
// role-based permissions server-side — see README "Roles & admin access".
import { getServerSession, type Session } from "next-auth";
import { authOptions, roleAtLeast } from "@/lib/auth";
import type { UserRole } from "@/generated/prisma/enums";

// Thrown by requireRole() below; API routes catch this and turn it into
// the right HTTP status code (401 = not signed in, 403 = wrong role).
export class UnauthorizedError extends Error {
  status: number;
  constructor(message = "Unauthorized", status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Server-side guard for admin API routes and pages. Throws (never just
 * hides UI) if there's no session, or if the session's role is below the
 * required minimum — the actual enforcement point, not the frontend.
 */
export async function requireRole(minimum: UserRole): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new UnauthorizedError("Sign in required", 401);
  if (!roleAtLeast(session.user.role, minimum)) {
    throw new UnauthorizedError("You don't have permission to do this", 403);
  }
  return session;
}
