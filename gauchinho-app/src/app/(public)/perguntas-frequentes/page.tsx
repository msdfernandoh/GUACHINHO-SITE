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
  title: "Perguntas frequentes | Gauchinho",
  description:
    "Respostas objetivas sobre consórcio, financiamento, cartas contempladas, grupos e atendimento — sempre como orientação, não promessa.",
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
          eyebrow="Gauchinho · Ajuda"
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
