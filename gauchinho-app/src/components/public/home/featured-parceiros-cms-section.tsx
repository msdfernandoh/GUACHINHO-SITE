import { ParceiroCard } from "@/components/conteudo/parceiro-card";
import {
  FeaturedContentReveal,
  FeaturedContentSection,
} from "@/components/conteudo/featured-content-section";
import type { ParceiroInstitucional } from "@/lib/conteudo/types";

export function FeaturedParceirosCmsSection({ parceiros }: { parceiros: ParceiroInstitucional[] }) {
  return (
    <FeaturedContentSection
      eyebrow="Confiança"
      title="Parceiros"
      subtitle="Administradoras, imobiliárias e empresas que reforçam nossa atuação no mercado."
      ctaHref="/parceiros"
      ctaLabel="Ver parceiros"
      hideIfEmpty
      empty={!parceiros.length}
    >
      {parceiros.map((p, i) => (
        <FeaturedContentReveal key={p.id} index={i}>
          <ParceiroCard parceiro={p} />
        </FeaturedContentReveal>
      ))}
    </FeaturedContentSection>
  );
}
