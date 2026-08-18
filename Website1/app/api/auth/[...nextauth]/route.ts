// NextAuth's catch-all route — handles sign-in, sign-out, session, and CSRF
// requests at /api/auth/* using the config from lib/auth.ts. Nothing else
// in the app calls this directly; next-auth/react's signIn()/signOut() do.
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
