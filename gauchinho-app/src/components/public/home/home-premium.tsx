import { loadHomePageData } from "@/lib/home/load-home-data";
import { HomeHeroPremium } from "./home-hero-premium";
import { DreamCardsSection } from "./dream-cards-section";
import { HomeVideoSection } from "./home-video-section";
import { QuickSimulatorSection } from "./quick-simulator-section";
import { AuthoritySection } from "./authority-section";
import { SolutionsSection } from "./solutions-section";
import { FeaturedGroupsSection } from "./featured-groups-section";
import { FeaturedLettersSection } from "./featured-letters-section";
import { FeaturedPropertiesSection } from "./featured-properties-section";
import { PartnersSection } from "./partners-section";
import { FinalCTASection } from "./final-cta-section";

export async function HomePremium() {
  const data = await loadHomePageData();

  return (
    <main className="overflow-x-hidden">
      <HomeHeroPremium site={data.site} />
      <DreamCardsSection />
      <HomeVideoSection />
      <QuickSimulatorSection defaults={data.simuladorDefaults} />
      <AuthoritySection />
      <SolutionsSection />
      <FeaturedGroupsSection items={data.gruposDestaque} />
      <FeaturedLettersSection cartas={data.cartasDestaque} />
      <FeaturedPropertiesSection imoveis={data.imoveisDestaque} config={data.homeOportunidades} />
      <PartnersSection imobiliarias={data.imobiliariasParceiras} />
      <FinalCTASection contato={data.contato} />
    </main>
  );
}
