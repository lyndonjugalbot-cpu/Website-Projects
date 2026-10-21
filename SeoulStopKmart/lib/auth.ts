// NextAuth configuration for admin/staff login — email + password
// ("Credentials" provider) checked against the User table, with bcrypt for
// password hashing. Sessions are JWT-based (no database Session table).
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/enums";

export const authOptions: NextAuthOptions = {
  // JWT sessions: the session token itself carries the user id/role,
  // instead of looking them up from a database Session row on every request.
  session: { strategy: "jwt" },
  // Where NextAuth redirects unauthenticated users trying to sign in.
  pages: { signIn: "/admin/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Called on every login attempt. Returning null means "invalid
      // credentials" — NextAuth doesn't distinguish "no such user" from
      // "wrong password" in the response, which avoids leaking which
      // emails have accounts.
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    // Runs when the JWT is created/updated — copies the role onto the token
    // so it's available without a database lookup on every request.
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: UserRole }).role;
      }
      return token;
    },
    // Runs whenever server code calls getServerSession() — exposes the id
    // and role from the token on session.user, matching the type
    // augmentation in next-auth.d.ts.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
};

/** Role hierarchy used for permission checks — higher index = more access. */
const ROLE_RANK: Record<UserRole, number> = { STAFF: 0, MANAGER: 1, OWNER: 2 };

/** True if `role` has at least as much access as `minimum` (e.g. OWNER passes a MANAGER check). */
export function roleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
