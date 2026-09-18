import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { resolveOriginFromHost, resolvePublicSiteUrl } from "@/lib/seo/site-url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  let siteUrl = resolvePublicSiteUrl();
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
    if (host) {
      siteUrl = resolveOriginFromHost(host, proto);
    }
  } catch {
    // Fallback padrão se chamado em contexto estático
  }

  const isLocal = siteUrl.startsWith("http://localhost");
  const privateDisallows = [
    "/admin/",
    "/erp/",
    "/login",
    "/esqueci-senha",
    "/definir-senha",
    "/auth/",
    "/api/",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/llms.txt", "/llms-full.txt"],
        disallow: privateDisallows,
      },
      {
        userAgent: [
          "Googlebot",
          "Bingbot",
          "Applebot",
          "Applebot-Extended",
          "GPTBot",
          "ChatGPT-User",
          "OAI-SearchBot",
          "PerplexityBot",
          "Google-Extended",
          "ClaudeBot",
          "anthropic-ai",
        ],
        allow: ["/", "/llms.txt", "/llms-full.txt"],
        disallow: privateDisallows,
      },
    ],
    sitemap: isLocal ? undefined : `${siteUrl}/sitemap.xml`,
  };
}

