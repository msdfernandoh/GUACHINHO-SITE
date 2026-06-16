import type { Metadata } from "next";
import { ConteudoHero, ConteudoPageShell } from "@/components/conteudo/conteudo-hero";
import { ParceirosPublicClient } from "@/components/conteudo/parceiros-public-client";
import { fetchPublicParceiros } from "@/lib/conteudo/fetch-public";
import { buildSimuladorUrl } from "@/lib/home/build-simulador-url";
import { DEFAULT_CONTATO, type ContatoConfig } from "@/lib/config/defaults";
import { getConfigJsonPublic } from "@/server/config";

export const metadata: Metadata = {
  title: "Parceiros | Gauchinho",
  description: "Rede de parceiros institucionais, administradoras, imobiliárias e correspondentes.",
};

function whatsappHref(contato: ContatoConfig) {
  const n = contato.whatsappPrincipal?.replace(/\D/g, "");
  if (!n) return "#contato";
  return `https://wa.me/${n}?text=${encodeURIComponent("Olá! Vi a página de parceiros e gostaria de mais informações.")}`;
}

export default async function ParceirosPage() {
  const [parceiros, contato] = await Promise.all([
    fetchPublicParceiros(),
    getConfigJsonPublic("contato", DEFAULT_CONTATO),
  ]);

  return (
    <ConteudoPageShell>
      <ConteudoHero
        eyebrow="Institucional"
        title="Parceiros"
        subtitle="Administradoras, imobiliárias, correspondentes e empresas que reforçam nossa atuação no mercado."
      />
      <ParceirosPublicClient
        parceiros={parceiros}
        simuladorHref={buildSimuladorUrl({ origem: "parceiros" })}
        whatsappHref={whatsappHref(contato)}
      />
    </ConteudoPageShell>
  );
}
