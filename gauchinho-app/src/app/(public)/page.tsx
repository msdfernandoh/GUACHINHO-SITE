import { getSimuladorConfigsPublic } from "@/lib/simulador/config";
import { loadHomeConteudoDestaques, loadHomePageData } from "@/lib/home/load-home-data";
import { getHomeModulosConfigPublic } from "@/server/config";
import { fetchHomeSorteioDestaque } from "@/lib/eventos-sorteio/public";
import { HomeV2Client } from "./home-v2-client";

export default async function HomePage() {
  const [simuladorConfigs, conteudo, homeData, homeModulos, sorteioDestaque] = await Promise.all([
    getSimuladorConfigsPublic(),
    loadHomeConteudoDestaques(),
    loadHomePageData(),
    getHomeModulosConfigPublic(),
    fetchHomeSorteioDestaque(),
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
}
