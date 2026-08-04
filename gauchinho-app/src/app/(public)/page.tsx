import { getSimuladorConfigsPublic } from "@/lib/simulador/config";
import { loadHomeConteudoDestaques, loadHomePageData } from "@/lib/home/load-home-data";
import { safeFetch } from "@/lib/home/safe-fetch";
import { getHomeModulosConfigPublic } from "@/server/config";
import { fetchHomeSorteioDestaque } from "@/lib/eventos-sorteio/public";
import { HomeV2Client } from "./home-v2-client";
import { DEFAULT_HOME_MODULOS } from "@/lib/config/home-modulos";
import { DEFAULT_HOME_OPORTUNIDADES } from "@/lib/config/defaults";

export const metadata: Metadata = {
  title: "Consórcios de Imóveis, Veículos, Caminhões e Máquinas",
  description: "Simule consórcio para imóvel, carro, moto, caminhão e máquinas. Compare parcelas, lance embutido, grupos e financiamento com orientação consultiva.",
  keywords: [
    "consórcio de imóvel",
    "consórcio de carro",
    "consórcio de caminhão",
    "consórcio de máquinas agrícolas",
    "simulador de consórcio",
    "lance embutido",
    "carta contemplada",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Gauchinho Consórcios e Soluções Financeiras",
    description: "Planejamento para imóveis, veículos, caminhões e máquinas com simulador e consultoria.",
    url: "/",
    type: "website",
    images: [{ url: "/media/gauchinho-campanha.jpeg", width: 1200, height: 630, alt: "Gauchinho Consórcios e Soluções Financeiras" }],
  },
  twitter: { card: "summary_large_image", title: "Gauchinho Consórcios", description: "Simule consórcios para imóveis, veículos, caminhões e máquinas.", images: ["/media/gauchinho-campanha.jpeg"] },
};

export default async function HomePage() {
  try {
    const [simuladorConfigs, conteudo, homeData, homeModulos, sorteioDestaque] = await Promise.all([
      getSimuladorConfigsPublic(),
      loadHomeConteudoDestaques(),
      loadHomePageData(),
      getHomeModulosConfigPublic(),
      safeFetch(() => fetchHomeSorteioDestaque(), null),
    ]);
    return (
      <HomeV2Client
        simuladorConfigs={simuladorConfigs}
        conteudoDestaques={conteudo}
        homeModulos={homeModulos}
        cartasDestaque={homeData.cartasDestaque}
        imoveisDestaque={homeData.imoveisDestaque}
        homeOportunidades={homeData.homeOportunidades}
        sorteioDestaque={sorteioDestaque}
      />
    );
  } catch (err) {
    console.error("[HomePage] falha ao carregar dados:", err);
    const simuladorConfigs = await getSimuladorConfigsPublic();
    return (
      <HomeV2Client
        simuladorConfigs={simuladorConfigs}
        conteudoDestaques={{ casosDestaque: [], dicasDestaque: [], parceirosDestaque: [] }}
        homeModulos={DEFAULT_HOME_MODULOS}
        cartasDestaque={[]}
        imoveisDestaque={[]}
        homeOportunidades={DEFAULT_HOME_OPORTUNIDADES}
        sorteioDestaque={null}
      />
    );
  }
}
import type { Metadata } from "next";
