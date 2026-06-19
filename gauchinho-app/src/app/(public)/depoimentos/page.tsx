import type { Metadata } from "next";
import { ConteudoHero, ConteudoPageShell } from "@/components/conteudo/conteudo-hero";
import { DepoimentosProvaSocialClient } from "@/components/conteudo/depoimentos-prova-social-client";
import { fetchPublicCasosSucesso, fetchPublicDepoimentos } from "@/lib/conteudo/fetch-public";
import { buildSimuladorUrl } from "@/lib/home/build-simulador-url";
import { DEFAULT_CONTATO, type ContatoConfig } from "@/lib/config/defaults";
import { getConfigJsonPublic } from "@/server/config";

export const metadata: Metadata = {
  title: "Depoimentos e casos de sucesso | Gauchinho",
  description:
    "Depoimentos de clientes e histórias de conquistas planejadas com consórcio, financiamento e orientação financeira.",
  openGraph: {
    title: "Depoimentos e histórias reais",
    description: "Prova social: depoimentos e casos de sucesso publicados pelo escritório.",
  },
};

function whatsappHref(contato: ContatoConfig) {
  const n = contato.whatsappPrincipal?.replace(/\D/g, "");
  if (!n) return "#contato";
  const text = encodeURIComponent(
    "Olá! Vi os depoimentos e casos de sucesso no site e gostaria de orientação para planejar uma conquista parecida.",
  );
  return `https://wa.me/${n}?text=${text}`;
}

export default async function DepoimentosPage() {
  const [depoimentos, casos, contato] = await Promise.all([
    fetchPublicDepoimentos(),
    fetchPublicCasosSucesso(),
    getConfigJsonPublic("contato", DEFAULT_CONTATO),
  ]);

  return (
    <ConteudoPageShell>
      <ConteudoHero
        eyebrow="Prova social"
        title="Depoimentos e histórias reais"
        subtitle="Veja o que clientes dizem sobre o atendimento e conheça exemplos de conquistas planejadas com estratégia e acompanhamento."
      />
      <DepoimentosProvaSocialClient
        depoimentos={depoimentos}
        casos={casos}
        simuladorHref={buildSimuladorUrl({ origem: "depoimentos" })}
        whatsappHref={whatsappHref(contato)}
      />
    </ConteudoPageShell>
  );
}
