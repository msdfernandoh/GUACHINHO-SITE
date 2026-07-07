import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { getConfigJsonPublic, DEFAULT_SITE } from "@/server/config";

export async function PublicJsonLd() {
  const siteUrl = getPublicSiteUrl();
  if (!siteUrl) return null;

  const site = await getConfigJsonPublic("site", DEFAULT_SITE);
  const name = site.nomeEmpresa?.trim() || "Gauchinho Consórcios e Soluções Financeiras";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name,
        url: siteUrl,
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
