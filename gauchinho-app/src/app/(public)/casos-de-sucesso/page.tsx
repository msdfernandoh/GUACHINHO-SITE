import type { Metadata } from "next";
import { ConteudoHero, ConteudoPageShell } from "@/components/conteudo/conteudo-hero";
import { CasosSucessoPublicClient } from "@/components/conteudo/casos-sucesso-public-client";
import { fetchPublicCasosSucesso } from "@/lib/conteudo/fetch-public";
import { buildSimuladorUrl } from "@/lib/home/build-simulador-url";
import { DEFAULT_CONTATO, type ContatoConfig } from "@/lib/config/defaults";
import { getConfigJsonPublic } from "@/server/config";

export const metadata: Metadata = {
  title: "Casos de sucesso | Gauchinho",
  description:
    "Histórias de conquistas planejadas — exemplos de orientação em consórcio, financiamento e planejamento financeiro.",
  openGraph: {
    title: "Histórias de conquistas planejadas",
    description:
      "Veja exemplos de clientes que buscaram orientação para transformar planos em conquistas com estratégia e acompanhamento.",
  },
};

function whatsappHref(contato: ContatoConfig) {
  const n = contato.whatsappPrincipal?.replace(/\D/g, "");
  if (!n) return "#contato";
  const text = encodeURIComponent(
    "Olá! Vi os casos de sucesso no site e gostaria de orientação para planejar uma conquista parecida.",
  );
  return `https://wa.me/${n}?text=${text}`;
}

export default async function CasosDeSucessoPage() {
  const [casos, contato] = await Promise.all([
    fetchPublicCasosSucesso(),
    getConfigJsonPublic("contato", DEFAULT_CONTATO),
  ]);

  return (
    <ConteudoPageShell>
      <ConteudoHero
        eyebrow="Prova social"
        title="Histórias de conquistas planejadas"
        subtitle="Veja exemplos de clientes que buscaram orientação para transformar planos em conquistas com estratégia, análise e acompanhamento."
      />
      <CasosSucessoPublicClient
        casos={casos}
        simuladorHref={buildSimuladorUrl({ origem: "casos_sucesso" })}
        whatsappHref={whatsappHref(contato)}
      />
    </ConteudoPageShell>
  );
}
