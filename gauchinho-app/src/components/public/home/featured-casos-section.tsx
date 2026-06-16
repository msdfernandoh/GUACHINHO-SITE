import { CasoSucessoCard } from "@/components/conteudo/caso-sucesso-card";
import {
  FeaturedContentReveal,
  FeaturedContentSection,
} from "@/components/conteudo/featured-content-section";
import type { CasoSucesso } from "@/lib/conteudo/types";

export function FeaturedCasosSection({ casos }: { casos: CasoSucesso[] }) {
  return (
    <FeaturedContentSection
      eyebrow="Prova social"
      title="Histórias de clientes"
      subtitle="Exemplos de planejamento e acompanhamento — sem promessa de resultado."
      ctaHref="/casos-de-sucesso"
      ctaLabel="Ver histórias"
      hideIfEmpty
      empty={!casos.length}
    >
      {casos.map((c, i) => (
        <FeaturedContentReveal key={c.id} index={i}>
          <CasoSucessoCard caso={c} featured={c.destaque} />
        </FeaturedContentReveal>
      ))}
    </FeaturedContentSection>
  );
}
