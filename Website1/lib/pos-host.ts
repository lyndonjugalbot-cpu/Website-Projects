// The POS register is served from its own hostname (e.g. pos.example.com)
// by this same deployment, so it shares the storefront's database. Kept
// dependency-free because middleware.ts (Edge runtime) imports it.
//
// A host counts as the POS host when it starts with "pos." (covers
// pos.yourdomain.com and pos.localhost in dev) or is listed in the
// comma-separated POS_HOSTNAMES env var (e.g. a seoulstopkmart-pos.vercel.app
// alias, which can't use a "pos." prefix).

export const POS_HOME = "/admin/pos";

export function isPosHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0].toLowerCase();
  if (hostname.startsWith("pos.")) return true;
  const extra = (process.env.POS_HOSTNAMES ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return extra.includes(hostname);
}

// Paths the POS host may serve; everything else redirects to the register.
// Static files (anything with an extension, e.g. /brand/logo.png and
// product images) are allowed so the register's images still load.
export function isAllowedOnPosHost(pathname: string): boolean {
  return (
    pathname === POS_HOME ||
    pathname.startsWith(POS_HOME + "/") ||
    pathname === "/admin/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/admin/pos") ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}
