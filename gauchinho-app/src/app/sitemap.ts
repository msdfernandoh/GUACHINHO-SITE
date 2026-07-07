import type { MetadataRoute } from "next";
import { fetchPublicImobiliariasParceiras } from "@/app/admin/imobiliarias/actions";
import { fetchPublicImoveis } from "@/app/admin/imoveis/actions";
import { fetchPublicEventosList } from "@/lib/comercial-eventos/public";
import { fetchPublicCasosSucesso, fetchPublicDicas } from "@/lib/conteudo/fetch-public";
import { resolvePublicSiteUrl } from "@/lib/seo/site-url";

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

function toLastModified(iso?: string | null): Date {
  if (iso) {
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function absoluteUrl(base: string, path: string): string {
  return path === "/" ? base : `${base}${path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = resolvePublicSiteUrl();

  const [dicas, casos, eventos, imoveis, imobiliarias] = await Promise.all([
    fetchPublicDicas().catch(() => []),
    fetchPublicCasosSucesso().catch(() => []),
    fetchPublicEventosList().catch(() => []),
    fetchPublicImoveis().catch(() => []),
    fetchPublicImobiliariasParceiras().catch(() => []),
  ]);

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_PATHS.map((path) => ({
    url: absoluteUrl(base, path),
    lastModified: new Date(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));

  const dynamicEntries: MetadataRoute.Sitemap = [
    ...dicas.map((item) => ({
      url: `${base}/dicas-do-tche/${item.slug}`,
      lastModified: toLastModified(item.updated_at ?? item.created_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...casos.map((item) => ({
      url: `${base}/casos-de-sucesso/${item.slug}`,
      lastModified: toLastModified(item.updated_at ?? item.created_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...eventos.map((item) => ({
      url: `${base}/eventos/${item.slug}`,
      lastModified: toLastModified(item.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.65,
    })),
    ...imobiliarias
      .filter((item) => item.slug?.trim())
      .map((item) => ({
        url: `${base}/oportunidades-imobiliarias/${item.slug}`,
        lastModified: toLastModified(item.updated_at),
        changeFrequency: "monthly" as const,
        priority: 0.55,
      })),
    ...imoveis
      .filter((item) => item.slug?.trim())
      .map((item) => ({
        url: `${base}/oportunidades-imobiliarias/imovel/${item.slug}`,
        lastModified: toLastModified(item.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.55,
      })),
  ];

  return [...staticEntries, ...dynamicEntries];
}
