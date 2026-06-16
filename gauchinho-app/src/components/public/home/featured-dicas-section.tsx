import { DicaTcheCard } from "@/components/conteudo/dica-tche-card";
import {
  FeaturedContentReveal,
  FeaturedContentSection,
} from "@/components/conteudo/featured-content-section";
import type { DicaTche } from "@/lib/conteudo/types";

export function FeaturedDicasSection({ dicas }: { dicas: DicaTche[] }) {
  return (
    <FeaturedContentSection
      eyebrow="Dicas do Tchê"
      title="Conteúdo rápido e direto"
      subtitle="Entenda consórcio, financiamento e cartas com linguagem simples."
      ctaHref="/dicas-do-tche"
      ctaLabel="Ver dicas"
      hideIfEmpty
      empty={!dicas.length}
    >
      {dicas.map((d, i) => (
        <FeaturedContentReveal key={d.id} index={i}>
          <DicaTcheCard dica={d} />
        </FeaturedContentReveal>
      ))}
    </FeaturedContentSection>
  );
}
