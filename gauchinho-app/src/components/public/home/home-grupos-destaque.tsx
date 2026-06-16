import Link from "next/link";
import type { HomeGrupoDestaque } from "@/lib/home/load-home-data";
import { formatCurrency } from "@/lib/utils/format";
import { formatPrazoGrupo } from "@/lib/grupos/simulacao-linha";
import { HomeCtaLink, HomeSection } from "./home-section";

export function HomeGruposDestaque({ items }: { items: HomeGrupoDestaque[] }) {
  if (!items.length) return null;

  return (
    <HomeSection
      eyebrow="Consórcio"
      title="Grupos em destaque"
      subtitle="Cotas ativas no sistema — simule quantidade, lance e seguro na tabela completa."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ grupo, cota }) => (
          <article
            key={grupo.id}
            className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-zinc-950 p-5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-lg font-bold text-white">Grupo {grupo.codigo_grupo}</h3>
              <span className="text-xs font-medium uppercase tracking-wide text-amber-500/90">
                {grupo.modalidade}
              </span>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Crédito (cota)</dt>
                <dd className="font-medium text-zinc-200">
                  {formatCurrency(Number(cota.valor_credito))}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Parcela ref.</dt>
                <dd className="font-medium text-amber-400/90">
                  {cota.valor_parcela != null
                    ? formatCurrency(Number(cota.valor_parcela))
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Prazo</dt>
                <dd className="text-zinc-300">{formatPrazoGrupo(grupo)}</dd>
              </div>
            </dl>
            <Link
              href="/grupos"
              className="mt-4 inline-block text-sm font-semibold text-amber-400 hover:text-amber-300"
            >
              Simular este grupo →
            </Link>
          </article>
        ))}
      </div>
      <div className="mt-8">
        <HomeCtaLink href="/grupos">Ver todos os grupos</HomeCtaLink>
      </div>
    </HomeSection>
  );
}
