import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import type { HomeOportunidadesConfig } from "@/lib/config/defaults";
import type { ImovelPublic } from "@/lib/imoveis/types";
import { buildSimuladorUrl } from "@/lib/home/build-simulador-url";
import { formatCurrency } from "@/lib/utils/format";
import { HomeReveal } from "./home-reveal";
import { HomeCtaLink, HomeSection } from "./home-section";

type Props = {
  imoveis: ImovelPublic[];
  config: HomeOportunidadesConfig;
};

export function FeaturedPropertiesSection({ imoveis, config }: Props) {
  if (!imoveis.length) return null;

  return (
    <HomeSection
      eyebrow="Imóveis"
      title="Oportunidades imobiliárias em destaque"
      subtitle="Parceiros selecionados — interesse registrado e orientação para simulação."
      className="bg-gradient-to-b from-zinc-950 to-zinc-900/30"
    >
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {imoveis.map((imovel, i) => {
          const valorLabel =
            config.mostrar_valor !== false &&
            imovel.exibir_valor_publico &&
            imovel.valor != null
              ? formatCurrency(Number(imovel.valor))
              : "Valor sob consulta";
          const simHref =
            config.mostrar_botao_simular !== false &&
            imovel.exibir_valor_publico &&
            imovel.valor != null
              ? buildSimuladorUrl({
                  tipo: "imovel",
                  solucao: "consorcio",
                  valor: Number(imovel.valor),
                  origem: "oportunidade_imobiliaria",
                  imovelId: imovel.id,
                })
              : null;

          return (
            <HomeReveal key={imovel.id} delayMs={i * 70}>
              <article className="group overflow-hidden rounded-3xl border border-zinc-800/90 bg-zinc-950/90 shadow-2xl shadow-black/30 transition hover:border-amber-500/30">
                <div className="relative aspect-[4/3] overflow-hidden bg-zinc-800">
                  {imovel.foto_principal_url ? (
                    <Image
                      src={imovel.foto_principal_url}
                      alt=""
                      fill
                      className="object-cover transition duration-700 group-hover:scale-105"
                      sizes="(max-width:768px) 100vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-600">
                      <MapPin className="h-14 w-14" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent" />
                  <p className="absolute bottom-3 left-4 text-lg font-bold text-amber-400">
                    {valorLabel}
                  </p>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-white">
                    <Link
                      href={`/oportunidades-imobiliarias/imovel/${imovel.slug}`}
                      className="hover:text-amber-400"
                    >
                      {imovel.titulo}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {[imovel.bairro, imovel.cidade].filter(Boolean).join(" · ") ||
                      "Localização sob consulta"}
                  </p>
                  {config.mostrar_nome_imobiliaria !== false && imovel.imobiliaria_nome ? (
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-600">
                      {imovel.imobiliaria_nome}
                    </p>
                  ) : null}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={`/oportunidades-imobiliarias/imovel/${imovel.slug}`}
                      className="rounded-full bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400"
                    >
                      Tenho interesse
                    </Link>
                    {config.mostrar_botao_simular !== false && simHref ? (
                      <Link
                        href={simHref}
                        className="rounded-full border border-zinc-600 px-4 py-2 text-xs font-semibold text-zinc-200 hover:border-amber-500/50"
                      >
                        Simular compra
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            </HomeReveal>
          );
        })}
      </div>
      {config.mostrar_botao_ver_oportunidades !== false ? (
        <div className="mt-10">
          <HomeCtaLink href="/oportunidades-imobiliarias">Ver todas as oportunidades</HomeCtaLink>
        </div>
      ) : null}
    </HomeSection>
  );
}
