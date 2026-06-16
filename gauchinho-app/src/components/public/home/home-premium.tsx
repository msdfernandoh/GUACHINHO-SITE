import { loadHomePageData } from "@/lib/home/load-home-data";
import { HomeHero } from "./home-hero";
import { HomeDreamCards } from "./home-dream-cards";
import { HomeQuickSimulator } from "./home-quick-simulator";
import { HomeAbout } from "./home-about";
import { HomeSolutions } from "./home-solutions";
import { HomeGruposDestaque } from "./home-grupos-destaque";
import { HomeCartasDestaque } from "./home-cartas-destaque";
import { HomeImoveisDestaque } from "./home-imoveis-destaque";
import { HomePlaceholders } from "./home-placeholders";
import { HomeParceiros } from "./home-parceiros";
import { HomeContato } from "./home-contato";

export async function HomePremium() {
  const data = await loadHomePageData();

  return (
    <>
      <HomeHero site={data.site} />
      <HomeDreamCards />
      <HomeQuickSimulator defaults={data.simuladorDefaults} />
      <HomeAbout site={data.site} />
      <HomeSolutions />
      <HomeGruposDestaque items={data.gruposDestaque} />
      <HomeCartasDestaque cartas={data.cartasDestaque} />
      <HomeImoveisDestaque imoveis={data.imoveisDestaque} config={data.homeOportunidades} />
      <HomePlaceholders />
      <HomeParceiros imobiliarias={data.imobiliariasParceiras} />
      <HomeContato contato={data.contato} />
    </>
  );
}
