import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.wotstcgvault.co.nz";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/dashboard/", "/messages", "/sell/new", "/reset-password"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
