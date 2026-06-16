import type { HomeGrupoDestaque } from "@/lib/home/load-home-data";
import { GroupCardMotion } from "./group-card-motion";
import { HomeCtaLink, HomeSection } from "./home-section";

export function FeaturedGroupsSection({ items }: { items: HomeGrupoDestaque[] }) {
  if (!items.length) return null;

  return (
    <HomeSection
      eyebrow="Consórcio"
      title="Grupos em destaque"
      subtitle="Cotas ativas no sistema — simule quantidade, lance e seguro na tabela completa."
      className="bg-zinc-900/20"
    >
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ grupo, cota }, i) => (
          <GroupCardMotion key={grupo.id} grupo={grupo} cota={cota} index={i} />
        ))}
      </div>
      <div className="mt-10">
        <HomeCtaLink href="/grupos">Ver todos os grupos</HomeCtaLink>
      </div>
    </HomeSection>
  );
}
