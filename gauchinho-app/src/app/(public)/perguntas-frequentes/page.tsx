import type { Metadata } from "next";
import { ConteudoHero, ConteudoPageShell } from "@/components/conteudo/conteudo-hero";
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
  return `https://wa.me/${n}?text=${encodeURIComponent("Olá! Tenho uma dúvida após ler o FAQ do site.")}`;
}

export default async function PerguntasFrequentesPage() {
  const [items, contato] = await Promise.all([
    fetchPublicFaq(),
    getConfigJsonPublic("contato", DEFAULT_CONTATO),
  ]);

  return (
    <ConteudoPageShell>
      <ConteudoViewTracker tipo_evento="faq_visualizado" entidade_tipo="lista" />
      <ConteudoHero
        eyebrow="FAQ"
        title="Perguntas frequentes"
        subtitle="Orientações gerais sobre consórcio, financiamento e cartas. Para sua situação específica, use a simulação ou fale com um especialista."
      />
      <div className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        <FAQAccordion items={items} categorias={FAQ_CATEGORIAS} />
        <div className="mt-12">
          <ConteudoCTA
            simuladorHref={buildSimuladorUrl({ origem: "faq" })}
            whatsappHref={whatsappHref(contato)}
          />
        </div>
      </div>
    </ConteudoPageShell>
  );
}
