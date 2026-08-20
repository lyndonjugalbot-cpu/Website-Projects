import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import FacebookProvider, { type FacebookProfile } from "next-auth/providers/facebook";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

/**
 * NextAuth is configured with the Prisma adapter for session/account
 * persistence, plus a Credentials provider for email+password login.
 * Facebook OAuth requires FACEBOOK_CLIENT_ID/SECRET (Meta app) — see
 * .env.example. Linking Facebook does NOT auto-publish the profile URL;
 * that requires separate explicit consent (FacebookConnection.publicConsent),
 * per the "no exposed private Facebook data" requirement.
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    newUser: "/register",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user || !user.passwordHash) return null;
        if (user.status === "BANNED" || user.status === "SUSPENDED") {
          throw new Error("This account has been suspended.");
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.displayName ?? user.fullName,
          image: user.avatarUrl,
          username: user.username,
          role: user.role,
        };
      },
    }),
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [
          FacebookProvider({
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
            // Links a Facebook login to an existing email/password account
            // that shares the same (Meta-verified) email address, so
            // "Connect Facebook" from account settings works without a
            // separate custom linking flow.
            allowDangerousEmailAccountLinking: true,
            // The adapter's createUser requires our schema's mandatory
            // fullName/username fields, which the default Facebook profile
            // shape doesn't provide — fill in reasonable placeholders here.
            // New Facebook-first signups are prompted to finish their
            // profile (pick a real username, confirm NZ location, accept
            // terms) on first visit to the dashboard.
            profile(profile: FacebookProfile) {
              return {
                id: profile.id,
                email: profile.email ?? `${profile.id}@facebook.placeholder`,
                image: profile.picture?.data?.url,
                name: profile.name,
                fullName: profile.name,
                username: `${slugify(profile.name)}-${profile.id.slice(-5)}`,
                role: "BUYER",
              } as never;
            },
          }),
        ]
      : []),
  ],
  events: {
    async linkAccount({ user, account, profile }) {
      if (account.provider !== "facebook") return;
      const fbProfile = profile as { id?: string; picture?: { data?: { url?: string } } };
      const facebookUserId = fbProfile.id ?? account.providerAccountId;
      await prisma.facebookConnection.upsert({
        where: { userId: user.id },
        update: { facebookUserId, profileUrl: `https://facebook.com/${facebookUserId}` },
        create: {
          userId: user.id,
          facebookUserId,
          profileUrl: `https://facebook.com/${facebookUserId}`,
          publicConsent: false,
        },
      });
      await prisma.user.update({ where: { id: user.id }, data: { isFacebookLinked: true } });
    },
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
      }
      // Keep role/status fresh on session update / token refresh, since a
      // ban or role change must take effect without waiting for re-login.
      if (trigger === "update" || !token.role) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, username: true, status: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.username = dbUser.username;
          if (dbUser.status === "BANNED" || dbUser.status === "SUSPENDED") {
            token.suspended = true;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
