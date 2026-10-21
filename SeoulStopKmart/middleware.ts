import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse, type NextFetchEvent } from "next/server";
import { POS_HOME, isAllowedOnPosHost, isPosHost } from "@/lib/pos-host";

// Gatekeeper for every /admin page and /api/admin endpoint. Authentication
// only — per-route role checks (OWNER/MANAGER/STAFF) happen server-side in
// each page/route handler via lib/authz.ts, since different admin actions
// require different minimum roles.
const requireAuth = withAuth(
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

function isProtected(pathname: string) {
  return (
    pathname === "/admin" ||
    (pathname.startsWith("/admin/") && pathname !== "/admin/login") ||
    pathname.startsWith("/api/admin/")
  );
}

export default function middleware(req: NextRequestWithAuth, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  // The POS hostname only serves the register (see lib/pos-host.ts); the
  // storefront and the rest of the admin stay on the main domain.
  if (isPosHost(req.headers.get("host")) && !isAllowedOnPosHost(pathname)) {
    return NextResponse.redirect(new URL(POS_HOME, req.url));
  }

  if (isProtected(pathname)) return requireAuth(req, event);
  return NextResponse.next();
}

export const config = {
  // Every route except Next's own build assets, so the POS host can fence
  // off storefront pages too.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
