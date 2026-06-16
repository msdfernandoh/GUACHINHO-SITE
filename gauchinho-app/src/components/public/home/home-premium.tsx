import { loadHomePageData } from "@/lib/home/load-home-data";
import { HeroMascote } from "./hero-mascote";
import { TrustBadgesSection } from "./trust-badges-section";
import { DreamCardsSection } from "./dream-cards-section";
import { HomeVideoSection } from "./home-video-section";
import { QuickSimulatorSection } from "./quick-simulator-section";
import { AuthoritySection } from "./authority-section";
import { SolutionsSection } from "./solutions-section";
import { FeaturedGroupsSection } from "./featured-groups-section";
import { FeaturedLettersSection } from "./featured-letters-section";
import { FeaturedPropertiesSection } from "./featured-properties-section";
import { FeaturedCasosSection } from "./featured-casos-section";
import { FeaturedDicasSection } from "./featured-dicas-section";
import { PartnersSection } from "./partners-section";
import { FinalCTASection } from "./final-cta-section";

export async function HomePremium() {
  const data = await loadHomePageData();
  const brand =
    data.site.nomeEmpresa?.trim() || "Gauchinho Escritório de Soluções Financeiras";

  return (
    <main className="overflow-x-hidden">
      <HeroMascote brand={brand} />
      <TrustBadgesSection />
      <DreamCardsSection />
      <HomeVideoSection />
      <QuickSimulatorSection defaults={data.simuladorDefaults} />
      <AuthoritySection />
      <SolutionsSection />
      <FeaturedGroupsSection items={data.gruposDestaque} />
      <FeaturedLettersSection cartas={data.cartasDestaque} />
      <FeaturedPropertiesSection imoveis={data.imoveisDestaque} config={data.homeOportunidades} />
      <FeaturedCasosSection casos={data.casosDestaque} />
      <FeaturedDicasSection dicas={data.dicasDestaque} />
      <PartnersSection
        imobiliarias={data.imobiliariasParceiras}
        parceirosCms={data.parceirosDestaque}
      />
      <FinalCTASection contato={data.contato} />
    </main>
  );
}
