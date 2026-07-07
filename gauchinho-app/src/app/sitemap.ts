import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

const PUBLIC_PATHS = [
  "/",
  "/simulador",
  "/calculadoras",
  "/grupos",
  "/cartas-contempladas",
  "/oportunidades-imobiliarias",
  "/eventos",
  "/dicas-do-tche",
  "/casos-de-sucesso",
  "/depoimentos",
  "/parceiros",
  "/perguntas-frequentes",
  "/seguradoras",
  "/indicar",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getPublicSiteUrl();
  const base = siteUrl ?? "http://localhost:3000";
  const now = new Date();

  return PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? base : `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
