import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const STAFF_ROLES = new Set(["SUPER_ADMIN", "MODERATOR", "VERIFICATION_REVIEWER", "SUPPORT"]);

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    if (req.nextUrl.pathname.startsWith("/admin") && !STAFF_ROLES.has(token?.role as string)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    if (token?.suspended) {
      return NextResponse.redirect(new URL("/login?suspended=1", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/sell/:path*",
    "/messages/:path*",
    "/admin/:path*",
    "/account/:path*",
  ],
};
