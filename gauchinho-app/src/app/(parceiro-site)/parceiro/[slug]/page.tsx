import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { InstitucionalV1Site } from "@/components/parceiro-site/institucional-v1";
import { RaconInspiredHome, type RaconTemplateIdentidade } from "@/components/public/templates/racon-inspired-home";
import { FASE3_PARCEIRO_PUBLIC_SITE_ENABLED } from "@/lib/parceiros/constants";
import { robotsForPartnerStatus } from "@/lib/parceiros/public-site-gates";
import { resolvePartnerPublicRequest } from "@/lib/parceiros/public-site-loader";
import {
  PARCEIRO_SITE_ID_HEADER,
  PARCEIRO_SITE_SLUG_HEADER,
} from "@/lib/parceiros/partner-site-types";
import { TENANT_EMPRESA_ID_HEADER, TENANT_SLUG_HEADER } from "@/lib/tenant/constants";

import { RaconJsonLd } from "@/components/public/seo/racon-json-ld";

type PageProps = { params: Promise<{ slug: string }> };

async function resolvePage(slug: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const empresaId = h.get(TENANT_EMPRESA_ID_HEADER);
  const empresaSlug = h.get(TENANT_SLUG_HEADER);
  // Headers de parceiro só são confiáveis se o proxy setou (já limpou o cliente).
  const headerSiteId = h.get(PARCEIRO_SITE_ID_HEADER);
  const headerSiteSlug = h.get(PARCEIRO_SITE_SLUG_HEADER);

  // Nunca confiar em slug do path divergente do header de parceiro quando presente.
  if (headerSiteSlug && headerSiteSlug !== slug) {
    return { ok: false as const, reason: "slug_mismatch" };
  }

  return resolvePartnerPublicRequest({
    hostHeader: host,
    pathname: `/parceiro/${slug}`,
    mode: "public",
    resolvedTenant:
      empresaId && empresaSlug
        ? { empresa_id: empresaId, empresa_slug: empresaSlug }
        : null,
  }).then((r) => {
    if (r.ok && headerSiteId && r.partner.parceiro_site_id !== headerSiteId) {
      return { ok: false as const, reason: "site_mismatch" };
    }
    return r;
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (!FASE3_PARCEIRO_PUBLIC_SITE_ENABLED) {
    return { robots: { index: false, follow: false } };
  }
  const { slug } = await params;
  const result = await resolvePage(slug);
  if (!result.ok) return { robots: { index: false, follow: false } };

  const robots = robotsForPartnerStatus(result.view.status_publicacao, result.view.is_preview);
  const canonical = result.partner.canonical_host
    ? `https://${result.partner.canonical_host}/`
    : undefined;

  const logo = result.view.logo_url ?? result.view.modelo_logo_padrao_url ?? undefined;
  const raconKeywords = [
    "racon sinop",
    "racon consorcios sinop",
    "consorcio sinop mt",
    "consorcio imobiliario sinop",
    "consorcio de automovel sinop",
    "consorcio pesados agricolas",
    "empresas randon sinop",
    "simulador racon",
    "carta contemplada sinop",
  ];

  return {
    title: result.view.seo_titulo,
    description: result.view.seo_descricao,
    keywords: raconKeywords,
    robots,
    alternates: canonical ? { canonical } : undefined,
    other: {
      "geo.region": "BR-MT",
      "geo.placename": "Sinop",
      "geo.position": "-11.8642;-55.5053",
      ICBM: "-11.8642, -55.5053",
    },
    openGraph: {
      title: result.view.seo_titulo,
      description: result.view.seo_descricao,
      type: "website",
      url: canonical,
      siteName: result.view.nome_site || "Racon Consórcios Sinop",
      locale: "pt_BR",
      ...(logo ? { images: [{ url: logo, alt: result.view.nome_site }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: result.view.seo_titulo,
      description: result.view.seo_descricao,
      ...(logo ? { images: [logo] } : {}),
    },
  };
}

export default async function ParceiroPublicPage({ params }: PageProps) {
  if (!FASE3_PARCEIRO_PUBLIC_SITE_ENABLED) {
    notFound();
  }

  const { slug } = await params;
  const result = await resolvePage(slug);
  if (!result.ok) notFound();

  if (result.redirect) {
    permanentRedirect(result.redirect.location);
  }

  const canonicalUrl = result.partner.canonical_host
    ? `https://${result.partner.canonical_host}/`
    : undefined;

  if (result.view.template_codigo === "racon_inspired") {
    return (
      <>
        <RaconJsonLd
          url={canonicalUrl}
          logoUrl={result.view.logo_url ?? result.view.modelo_logo_padrao_url}
          telefone={result.view.contato.telefone}
          whatsapp={result.view.contato.whatsapp}
        />
        <RaconInspiredHome
          empresaNome={result.view.nome_site}
          logoUrl={result.view.logo_url ?? result.view.modelo_logo_padrao_url}
          identidade={result.view.modelo_identidade as RaconTemplateIdentidade}
          menus={result.view.modelo_menus}
          secoes={result.view.modelo_secoes}
          telefoneContato={result.view.contato.telefone ?? undefined}
          whatsappContato={result.view.contato.whatsapp ?? undefined}
          footerCopyright={result.view.modelo_footer_copyright ?? result.view.tenant_identificacao}
        />
      </>
    );
  }
  if (result.view.template_codigo === "institucional_v1") return <InstitucionalV1Site vm={result.view} />;
  notFound();
}
