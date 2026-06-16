import { getSimuladorConfigsPublic } from "@/lib/simulador/config";
import { loadHomeConteudoDestaques } from "@/lib/home/load-home-data";
import { HomeV2Client } from "./home-v2-client";

export default async function HomePage() {
  const [simuladorConfigs, conteudo] = await Promise.all([
    getSimuladorConfigsPublic(),
    loadHomeConteudoDestaques(),
  ]);
  return (
    <HomeV2Client simuladorConfigs={simuladorConfigs} conteudoDestaques={conteudo} />
  );
}
