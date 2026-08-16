import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Gatekeeper for every /admin page and /api/admin endpoint. Authentication
// only — per-route role checks (OWNER/MANAGER/STAFF) happen server-side in
// each page/route handler via lib/authz.ts, since different admin actions
// require different minimum roles.
export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    pages: { signIn: "/admin/login" },
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
  }
);

export const config = {
  matcher: ["/admin", "/admin/((?!login).*)", "/api/admin/:path*"],
};
