import Image from "next/image";
import { PARCEIROS_FIXOS } from "@/lib/home/home-content";
import { HomeSection } from "./home-section";

type ImobParceira = {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
  cidade: string | null;
};

export function HomeParceiros({ imobiliarias }: { imobiliarias: ImobParceira[] }) {
  return (
    <HomeSection
      eyebrow="Confiança"
      title="Parceiros"
      subtitle="Administradoras, crédito, educação e imobiliárias que fortalecem nossas soluções."
      className="border-y border-zinc-800/60"
    >
      <div className="flex flex-wrap justify-center gap-4">
        {PARCEIROS_FIXOS.map((p) => (
          <div
            key={p.nome}
            className="flex min-w-[140px] flex-col items-center rounded-xl border border-zinc-800 bg-zinc-900/50 px-6 py-5 text-center transition hover:border-amber-500/30"
          >
            <span className="text-base font-bold text-white">{p.nome}</span>
            <span className="mt-1 text-xs text-zinc-500">{p.tag}</span>
          </div>
        ))}
        {imobiliarias.map((im) => (
          <div
            key={im.id}
            className="flex min-w-[140px] flex-col items-center rounded-xl border border-zinc-800 bg-zinc-900/50 px-6 py-5 text-center"
          >
            {im.logo_url ? (
              <div className="relative mb-2 h-10 w-24">
                <Image src={im.logo_url} alt="" fill className="object-contain" />
              </div>
            ) : null}
            <span className="text-sm font-semibold text-white">{im.nome}</span>
            <span className="mt-1 text-xs text-zinc-500">Imobiliária parceira</span>
          </div>
        ))}
      </div>
    </HomeSection>
  );
}
