import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { serializeJsonLd } from "@/lib/seo/json-ld";
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
        "@type": ["Organization", "FinancialService", "LocalBusiness"],
        "@id": `${siteUrl}/#organization`,
        name,
        legalName: name,
        url: siteUrl,
        logo: `${siteUrl}/media/gauchinho-logo.png`,
        image: `${siteUrl}/media/gauchinho-campanha.jpeg`,
        description:
          site.descricaoInstitucional?.trim() ||
          "Consultoria especializada, simulação e planejamento de consórcios imobiliários, veiculares e pesados com atendimento em Sinop MT e todo o Brasil.",
        ...(contato.telefone?.trim()
          ? { telephone: contato.telefone.trim() }
          : {}),
        ...(contato.email?.trim() ? { email: contato.email.trim() } : {}),
        ...(instagram ? { sameAs: [instagram] } : {}),
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
          { "@type": "State", name: "Mato Grosso" },
          { "@type": "Country", name: "Brasil" },
        ],
        priceRange: "$$",
        openingHoursSpecification: [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
            ],
            opens: "08:00",
            closes: "18:00",
          },
        ],
        knowsAbout: [
          "Consórcio imobiliário",
          "Consórcio de veículos e automóveis",
          "Consórcio de caminhões e implementos",
          "Consórcio de máquinas agrícolas",
          "Lance embutido",
          "Cartas de crédito contempladas",
          "Comparativo de consórcio contra financiamento bancário",
          "Planejamento financeiro para agronegócio e pessoas físicas",
        ],
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Modalidades de Consórcio e Crédito",
          itemListElement: [
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "FinancialProduct",
                name: "Consórcio Imobiliário com Parcela Reduzida",
                description: "Crédito para compra de casa, apartamento, terreno, construção ou reforma em Sinop MT e em todo o Brasil.",
                url: `${siteUrl}/consorcio/imovel-parcela-reduzida`,
              },
            },
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "FinancialProduct",
                name: "Consórcio de Automóveis e Veículos sem Entrada",
                description: "Planejamento para carros novos e seminovos sem juros bancários e com parcelas acessíveis.",
                url: `${siteUrl}/consorcio/carro-sem-entrada`,
              },
            },
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "FinancialProduct",
                name: "Consórcio de Caminhões e Máquinas Agrícolas",
                description: "Aquisição de caminhões pesados, cavalos mecânicos, tratores e colheitadeiras para o agronegócio de Mato Grosso.",
                url: `${siteUrl}/consorcio/maquinas-agricolas`,
              },
            },
          ],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name,
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
            name: "Como funciona o consórcio imobiliário em Sinop MT?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "O consórcio imobiliário é uma modalidade de compra colaborativa sem juros bancários. O consorciado adquire uma cota em um grupo regulado pelo Banco Central e participa de assembleias mensais, podendo ser contemplado por sorteio ou oferta de lance (livre ou embutido).",
            },
          },
          {
            "@type": "Question",
            name: "O que é o lance embutido no consórcio?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "O lance embutido é a possibilidade de utilizar parte do próprio crédito contratado (por exemplo, 20% a 30%) como lance para aumentar a chance de contemplação sem precisar desembolsar dinheiro do próprio bolso no momento da oferta.",
            },
          },
          {
            "@type": "Question",
            name: "Qual a vantagem do consórcio em relação ao financiamento?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No financiamento bancário há juros compostos que muitas vezes dobram ou triplicam o valor total pago pelo bem ao longo de 30 anos. No consórcio não há juros, apenas taxa de administração pré-fixada diluída pelo prazo contratado.",
            },
          },
          {
            "@type": "Question",
            name: "Como realizar uma simulação no Gauchinho Consórcios?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Basta acessar a página de simulador em nosso site oficial, selecionar o bem desejado (imóvel, veículo, pesados ou agro), escolher o valor do crédito e verificar os prazos e opções de parcelas disponíveis com orientação consultiva imediata.",
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
