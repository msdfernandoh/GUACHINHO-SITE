import type { Metadata } from "next";
import { PublicPremiumHero } from "@/components/public/public-premium-hero";
import { simuladorShell } from "@/components/simulador/simulador-ui";
import { FAQAccordion } from "@/components/conteudo/faq-accordion";
import { ConteudoCTA } from "@/components/conteudo/conteudo-cta";
import { ConteudoViewTracker } from "@/components/conteudo/conteudo-view-tracker";
import { fetchPublicFaq } from "@/lib/conteudo/fetch-public";
import { FAQ_CATEGORIAS } from "@/lib/conteudo/types";
import { buildSimuladorUrl } from "@/lib/home/build-simulador-url";
import { DEFAULT_CONTATO, type ContatoConfig } from "@/lib/config/defaults";
import { getConfigJsonPublic } from "@/server/config";

export const metadata: Metadata = {
  title: "Perguntas Frequentes sobre Consórcio | FAQ Completo",
  description:
    "Tire todas as suas dúvidas sobre consórcios imobiliários, veículos e pesados: como funcionam assembleias, lances livres, lance embutido, reajustes e contemplação.",
  keywords: [
    "como funciona consórcio",
    "como funciona lance embutido",
    "contemplação por sorteio ou lance",
    "dúvidas sobre consórcio",
    "faq consórcio sinop mt",
  ],
  alternates: { canonical: "/perguntas-frequentes" },
  openGraph: {
    title: "Perguntas Frequentes sobre Consórcio | FAQ Completo",
    description: "Respostas transparentes sobre funcionamento, lances e contemplação de consórcios.",
    url: "/perguntas-frequentes",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dúvidas sobre Consórcio | Gauchinho & Racon",
    description: "Entenda o funcionamento de consórcios com respostas diretas.",
  },
};

function whatsappHref(contato: ContatoConfig) {
  const n = contato.whatsappPrincipal?.replace(/\D/g, "");
  if (!n) return "#contato";
  return `https://wa.me/${n}?text=${encodeURIComponent("Olá! Tenho uma dúvida após ler as perguntas frequentes do site.")}`;
}

export default async function PerguntasFrequentesPage() {
  const [items, contato] = await Promise.all([
    fetchPublicFaq(),
    getConfigJsonPublic("contato", DEFAULT_CONTATO),
  ]);

  return (
    <div className={simuladorShell}>
      <ConteudoViewTracker tipo_evento="faq_visualizado" entidade_tipo="lista" />
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <PublicPremiumHero
          eyebrow="Ajuda"
          title="Perguntas frequentes"
          subtitle="Tire as principais dúvidas antes de simular, indicar ou falar com um especialista."
        />
        <div className="mx-auto max-w-4xl">
          <FAQAccordion items={items} categorias={FAQ_CATEGORIAS} />
          <div className="mt-12">
            <ConteudoCTA
              simuladorHref={buildSimuladorUrl({ origem: "faq" })}
              whatsappHref={whatsappHref(contato)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
