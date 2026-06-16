import Image from "next/image";
import { PARCEIROS_FIXOS } from "@/lib/home/home-content";
import { HomeReveal } from "./home-reveal";
import { HomeSection } from "./home-section";

type ImobParceira = {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
  cidade: string | null;
};

export function PartnersSection({ imobiliarias }: { imobiliarias: ImobParceira[] }) {
  const all = [
    ...PARCEIROS_FIXOS.map((p) => ({ id: p.nome, nome: p.nome, tag: p.tag, logo_url: null as string | null })),
    ...imobiliarias.map((im) => ({
      id: im.id,
      nome: im.nome,
      tag: "Imobiliária parceira",
      logo_url: im.logo_url,
    })),
  ];

  return (
    <HomeSection
      eyebrow="Confiança"
      title="Parceiros"
      subtitle="Administradoras, crédito, educação e imobiliárias em vitrine premium."
      className="border-y border-zinc-800/60"
    >
      <div className="flex flex-wrap justify-center gap-4 md:gap-5">
        {all.map((p, i) => (
          <HomeReveal key={p.id} delayMs={i * 40}>
            <div className="flex min-h-[120px] min-w-[150px] max-w-[200px] flex-col items-center justify-center rounded-2xl border border-zinc-800/90 bg-zinc-900/50 px-6 py-6 text-center shadow-lg shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-amber-500/35 hover:bg-zinc-900/90">
              {p.logo_url ? (
                <div className="relative mb-3 h-10 w-28">
                  <Image src={p.logo_url} alt="" fill className="object-contain" />
                </div>
              ) : (
                <span className="text-lg font-bold tracking-tight text-white">{p.nome}</span>
              )}
              {p.logo_url ? (
                <span className="mt-1 text-sm font-semibold text-zinc-200">{p.nome}</span>
              ) : null}
              <span className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">{p.tag}</span>
            </div>
          </HomeReveal>
        ))}
      </div>
    </HomeSection>
  );
}
