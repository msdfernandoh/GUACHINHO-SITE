import type { Metadata } from "next";
import { PublicPremiumHero } from "@/components/public/public-premium-hero";
import { simuladorShell } from "@/components/simulador/simulador-ui";
import { DicasTchePublicClient } from "@/components/conteudo/dicas-tche-public-client";
import { fetchPublicDicas } from "@/lib/conteudo/fetch-public";
import { buildSimuladorUrl } from "@/lib/home/build-simulador-url";
import { DEFAULT_CONTATO, type ContatoConfig } from "@/lib/config/defaults";
import { getConfigJsonPublic } from "@/server/config";

export const metadata: Metadata = {
  title: "Conteúdos e dicas",
  description:
    "Conteúdos rápidos para entender consórcio, financiamento, cartas contempladas e planejamento financeiro.",
};

function whatsappHref(contato: ContatoConfig) {
  const n = contato.whatsappPrincipal?.replace(/\D/g, "");
  if (!n) return "#contato";
  return `https://wa.me/${n}?text=${encodeURIComponent("Olá! Li as Dicas do Tchê e gostaria de orientação.")}`;
}

export default async function DicasDoTchePage() {
  const [dicas, contato] = await Promise.all([
    fetchPublicDicas(),
    getConfigJsonPublic("contato", DEFAULT_CONTATO),
  ]);

  return (
    <div className={simuladorShell}>
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <PublicPremiumHero
          eyebrow="Conteúdo"
          title="Dicas do Tchê"
          subtitle="Conteúdos rápidos para você entender melhor consórcio, financiamento, cartas contempladas e planejamento financeiro."
        />
        <DicasTchePublicClient
          dicas={dicas}
          simuladorHref={buildSimuladorUrl({ origem: "dicas_tche" })}
          whatsappHref={whatsappHref(contato)}
        />
      </div>
    </div>
  );
}
