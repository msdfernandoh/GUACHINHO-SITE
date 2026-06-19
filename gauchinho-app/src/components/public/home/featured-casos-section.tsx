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
      title="Histórias de conquistas planejadas"
      subtitle="Veja exemplos de clientes que buscaram orientação para transformar planos em conquistas com estratégia, análise e acompanhamento."
      ctaHref="/depoimentos#casos-de-sucesso"
      ctaLabel="Ver depoimentos e histórias"
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
