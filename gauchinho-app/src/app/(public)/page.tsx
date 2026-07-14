import { getSimuladorConfigsPublic } from "@/lib/simulador/config";
import { loadHomeConteudoDestaques, loadHomePageData } from "@/lib/home/load-home-data";
import { safeFetch } from "@/lib/home/safe-fetch";
import { getHomeModulosConfigPublic } from "@/server/config";
import { fetchHomeSorteioDestaque } from "@/lib/eventos-sorteio/public";
import { HomeV2Client } from "./home-v2-client";
import { DEFAULT_HOME_MODULOS } from "@/lib/config/home-modulos";
import { DEFAULT_HOME_OPORTUNIDADES } from "@/lib/config/defaults";

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
