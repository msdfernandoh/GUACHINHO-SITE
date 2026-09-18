import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { fetchPublicImobiliariasParceiras } from "@/app/admin/imobiliarias/actions";
import { fetchPublicImoveis } from "@/app/admin/imoveis/actions";
import { fetchPublicEventosList } from "@/lib/comercial-eventos/public";
import { fetchPublicCasosSucesso, fetchPublicDicas } from "@/lib/conteudo/fetch-public";
import { isRaconHost, resolveOriginFromHost, resolvePublicSiteUrl } from "@/lib/seo/site-url";
import { CONSORCIO_SEO_SEGMENTS } from "@/lib/seo/consorcio-segments";

export const dynamic = "force-dynamic";

/** Rotas públicas canônicas da Gauchinho Consórcios (sem URLs com redirect 308). */
const GAUCHINHO_PUBLIC_PATHS = [
  "/",
  "/simulador",
  "/calculadoras",
  "/grupos",
  "/cartas-contempladas",
  "/oportunidades-imobiliarias",
  "/eventos",
  "/dicas-do-tche",
  "/depoimentos",
  "/parceiros",
  "/perguntas-frequentes",
  "/seguradoras",
  "/indicar",
  "/consorcio",
] as const;

/** Rotas públicas canônicas da Racon Sinop MT. */
const RACON_PUBLIC_PATHS = [
  "/",
  "/simulador",
  "/grupos",
  "/consorcio",
  "/parceiros",
  "/perguntas-frequentes",
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
  let host: string | null = null;
  let proto = "https";
  try {
    const h = await headers();
    host = h.get("x-forwarded-host") || h.get("host");
    proto = h.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  } catch {
    // Contexto estático de build
  }

  const isRacon = isRaconHost(host);
  const base = resolveOriginFromHost(host, proto);

  if (isRacon) {
    // Sitemap focado e otimizado exclusivamente para o portal da Racon Sinop
    const raconStaticEntries: MetadataRoute.Sitemap = RACON_PUBLIC_PATHS.map((path) => ({
      url: absoluteUrl(base, path),
      lastModified: new Date(),
      changeFrequency: path === "/" ? "weekly" : "monthly",
      priority: path === "/" ? 1.0 : 0.8,
    }));

    const raconDynamicSegments: MetadataRoute.Sitemap = CONSORCIO_SEO_SEGMENTS.map((item) => ({
      url: `${base}/consorcio/${item.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.75,
    }));

    return [...raconStaticEntries, ...raconDynamicSegments];
  }

  // Sitemap completo do portal Gauchinho Consórcios
  const [dicas, casos, eventos, imoveis, imobiliarias] = await Promise.all([
    fetchPublicDicas().catch(() => []),
    fetchPublicCasosSucesso().catch(() => []),
    fetchPublicEventosList().catch(() => []),
    fetchPublicImoveis().catch(() => []),
    fetchPublicImobiliariasParceiras().catch(() => []),
  ]);

  const staticEntries: MetadataRoute.Sitemap = GAUCHINHO_PUBLIC_PATHS.map((path) => ({
    url: absoluteUrl(base, path),
    lastModified: new Date(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));

  const dynamicEntries: MetadataRoute.Sitemap = [
    ...CONSORCIO_SEO_SEGMENTS.map((item) => ({
      url: `${base}/consorcio/${item.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
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
