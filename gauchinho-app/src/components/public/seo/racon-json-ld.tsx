import { serializeJsonLd } from "@/lib/seo/json-ld";

type Props = {
  url?: string;
  logoUrl?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
};

export function RaconJsonLd({ url = "https://www.raconsinop.com.br", logoUrl, telefone, whatsapp }: Props) {
  const siteUrl = url.replace(/\/$/, "");
  const logo = logoUrl || `${siteUrl}/analise/logoracon.jpg`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "FinancialService", "LocalBusiness"],
        "@id": `${siteUrl}/#organization`,
        name: "Racon Consórcios Sinop",
        legalName: "Racon Consórcios — Unidade Autorizada Sinop MT",
        alternateName: ["Racon Sinop", "Racon Consórcios Sinop MT", "Racon Empresas Randon Sinop"],
        url: siteUrl,
        logo,
        image: logo,
        description:
          "Unidade autorizada Racon Consórcios em Sinop MT. Especialista em consórcio imobiliário, veicular, caminhões e máquinas agrícolas do Grupo Empresas Randon.",
        parentOrganization: {
          "@type": "Organization",
          name: "Racon Consórcios (Empresas Randon)",
          url: "https://www.racon.com.br",
        },
        ...(telefone ? { telephone: telefone } : {}),
        address: {
          "@type": "PostalAddress",
          addressLocality: "Sinop",
          addressRegion: "MT",
          addressCountry: "BR",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: -11.8642,
          longitude: -55.5053,
        },
        areaServed: [
          { "@type": "City", name: "Sinop" },
          { "@type": "City", name: "Sorriso" },
          { "@type": "City", name: "Lucas do Rio Verde" },
          { "@type": "City", name: "Nova Mutum" },
          { "@type": "City", name: "Alta Floresta" },
          { "@type": "State", name: "Mato Grosso" },
          { "@type": "Country", name: "Brasil" },
        ],
        priceRange: "$$",
        openingHoursSpecification: [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            opens: "08:00",
            closes: "18:00",
          },
        ],
        knowsAbout: [
          "Consórcio de imóveis",
          "Consórcio de automóveis e veículos leves",
          "Consórcio de caminhões e pesados",
          "Consórcio de máquinas agrícolas",
          "Lance embutido de até 30%",
          "Cartas contempladas Racon",
          "Empresas Randon",
        ],
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Planos de Consórcio Racon Sinop",
          itemListElement: [
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "FinancialProduct",
                name: "Consórcio Imobiliário Racon Sinop",
                description: "Planeje a compra de imóveis, terrenos, construção ou reforma com parcelas reduzidas até a contemplação.",
                url: `${siteUrl}/simulador`,
              },
            },
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "FinancialProduct",
                name: "Consórcio de Veículos e Automóveis Racon",
                description: "Crédito para carros novos e seminovos sem entrada e sem taxas de juros bancários.",
                url: `${siteUrl}/simulador`,
              },
            },
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "FinancialProduct",
                name: "Consórcio Pesados e Maquinários Agrícolas Racon",
                description: "Caminhões e equipamentos agrícolas com a solidez e tradição do Grupo Empresas Randon.",
                url: `${siteUrl}/grupos`,
              },
            },
          ],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "Racon Consórcios Sinop",
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "pt-BR",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${siteUrl}/grupos?busca={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${siteUrl}/#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "Como contratar consórcio na Racon Sinop MT?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "A contratação pode ser realizada 100% online ou com atendimento presencial em Sinop MT. Você escolhe o crédito e o prazo ideal no simulador oficial e conta com consultores credenciados para estruturar a sua proposta.",
            },
          },
          {
            "@type": "Question",
            name: "Como funciona o lance embutido na Racon?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Na Racon Consórcios é possível utilizar até 30% da própria carta de crédito para ofertar lance nas assembleias. Ao ser contemplado, esse percentual é deduzido do crédito recebido, sem exigir desembolso em dinheiro no momento da oferta.",
            },
          },
          {
            "@type": "Question",
            name: "O consórcio imobiliário Racon permite construir em Sinop?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Sim! A carta de crédito imobiliária da Racon pode ser utilizada para aquisição de terreno/lote e realização de construção ou reforma comercial e residencial na cidade de Sinop e em todo o estado de Mato Grosso.",
            },
          },
          {
            "@type": "Question",
            name: "A Racon Consórcios é fiscalizada pelo Banco Central?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Sim. A Racon Consórcios é uma administradora autorizada e fiscalizada pelo Banco Central do Brasil, integrante do conglomerado Empresas Randon, garantindo máxima segurança jurídica e solidez financeira aos consorciados.",
            },
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
    />
  );
}
