import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import type { HomeOportunidadesConfig } from "@/lib/config/defaults";
import type { ImovelPublic } from "@/lib/imoveis/types";
import { buildSimuladorUrl } from "@/lib/home/build-simulador-url";
import { formatCurrency } from "@/lib/utils/format";
import { HomeCtaLink, HomeSection } from "./home-section";

type Props = {
  imoveis: ImovelPublic[];
  config: HomeOportunidadesConfig;
};

export function HomeImoveisDestaque({ imoveis, config }: Props) {
  if (!imoveis.length) return null;

  return (
    <HomeSection
      eyebrow="Imóveis"
      title="Oportunidades imobiliárias em destaque"
      subtitle="Parceiros selecionados — interesse registrado e WhatsApp direcionado."
    >
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {imoveis.map((imovel) => {
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
            <article
              key={imovel.id}
              className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80"
            >
              <div className="relative aspect-[4/3] bg-zinc-800">
                {imovel.foto_principal_url ? (
                  <Image
                    src={imovel.foto_principal_url}
                    alt=""
                    fill
                    className="object-cover transition duration-500 hover:scale-105"
                    sizes="(max-width:768px) 100vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-600">
                    <MapPin className="h-12 w-12" />
                  </div>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-white">
                  <Link
                    href={`/oportunidades-imobiliarias/imovel/${imovel.slug}`}
                    className="hover:text-amber-400"
                  >
                    {imovel.titulo}
                  </Link>
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {[imovel.bairro, imovel.cidade].filter(Boolean).join(" · ") || "Localização sob consulta"}
                </p>
                {config.mostrar_nome_imobiliaria !== false && imovel.imobiliaria_nome ? (
                  <p className="mt-1 text-xs text-zinc-600">{imovel.imobiliaria_nome}</p>
                ) : null}
                <p className="mt-3 text-lg font-bold text-amber-400">{valorLabel}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/oportunidades-imobiliarias/imovel/${imovel.slug}`}
                    className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
                  >
                    Tenho interesse
                  </Link>
                  {config.mostrar_botao_simular !== false && simHref ? (
                    <Link
                      href={simHref}
                      className="rounded-full border border-zinc-600 px-4 py-2 text-xs font-medium text-zinc-200 hover:border-amber-500/50"
                    >
                      Simular compra
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {config.mostrar_botao_ver_oportunidades !== false ? (
        <div className="mt-8">
          <HomeCtaLink href="/oportunidades-imobiliarias">Ver todas as oportunidades</HomeCtaLink>
        </div>
      ) : null}
    </HomeSection>
  );
}
