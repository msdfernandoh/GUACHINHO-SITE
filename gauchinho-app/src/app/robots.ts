import type { MetadataRoute } from "next";
import { resolvePublicSiteUrl } from "@/lib/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = resolvePublicSiteUrl();
  const isLocal = siteUrl.startsWith("http://localhost");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/login", "/api/"],
    },
    sitemap: isLocal ? undefined : `${siteUrl}/sitemap.xml`,
  };
}
