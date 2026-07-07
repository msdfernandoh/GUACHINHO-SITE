import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/login", "/api/"],
    },
    sitemap: siteUrl ? `${siteUrl}/sitemap.xml` : undefined,
  };
}
