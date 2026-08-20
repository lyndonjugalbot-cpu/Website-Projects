import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaff, can } from "@/lib/rbac";
import type { Role } from "@prisma/client";

/**
 * Shared guard for every /api/admin/* route: confirms the caller is
 * authenticated staff and (optionally) holds a specific capability.
 * Returns either `{ session }` to proceed or `{ response }` to short-circuit.
 */
export async function requireStaff(capability?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const role = session.user.role as Role;
  if (!isStaff(role) || (capability && !can(role, capability))) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}
