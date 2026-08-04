import { getPublicSiteUrl } from "@/lib/seo/site-url";
import {
  getConfigJsonPublic,
  DEFAULT_CONTATO,
  DEFAULT_SITE,
} from "@/server/config";

export async function PublicJsonLd() {
  const siteUrl = getPublicSiteUrl();
  if (!siteUrl) return null;

  const [site, contato] = await Promise.all([
    getConfigJsonPublic("site", DEFAULT_SITE),
    getConfigJsonPublic("contato", DEFAULT_CONTATO),
  ]);
  const name = site.nomeEmpresa?.trim() || "Gauchinho Consórcios e Soluções Financeiras";
  const instagram = contato.instagram?.trim();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name,
        url: siteUrl,
        logo: `${siteUrl}/media/gauchinho-logo.png`,
        image: `${siteUrl}/media/gauchinho-campanha.jpeg`,
        description:
          site.descricaoInstitucional?.trim() ||
          "Consultoria, simulação e planejamento de consórcios e soluções financeiras.",
        ...(contato.telefone?.trim()
          ? { telephone: contato.telefone.trim() }
          : {}),
        ...(contato.email?.trim() ? { email: contato.email.trim() } : {}),
        ...(instagram ? { sameAs: [instagram] } : {}),
        areaServed: { "@type": "Country", name: "Brasil" },
        knowsAbout: [
          "Consórcio de imóveis",
          "Consórcio de veículos",
          "Consórcio de caminhões",
          "Consórcio de máquinas agrícolas",
          "Lance embutido",
          "Cartas de crédito contempladas",
          "Comparação entre consórcio e financiamento",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name,
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "pt-BR",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
