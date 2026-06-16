import Link from "next/link";
import type { CartaContemplada } from "@/lib/cartas/types";
import { CARTA_STATUS_LABELS, CARTA_TIPOS } from "@/lib/cartas/types";
import { formatCurrency } from "@/lib/utils/format";
import { HomeCtaLink, HomeSection } from "./home-section";

export function HomeCartasDestaque({ cartas }: { cartas: CartaContemplada[] }) {
  if (!cartas.length) return null;

  return (
    <HomeSection
      eyebrow="Cartas"
      title="Cartas contempladas em destaque"
      subtitle="Oportunidades ativas — detalhes e interesse na vitrine completa."
      className="bg-zinc-900/25"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cartas.map((c) => {
          const tipo = CARTA_TIPOS.find((t) => t.value === c.tipo_carta)?.label ?? c.tipo_carta;
          return (
            <article
              key={c.id}
              className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase text-amber-500">{tipo}</span>
                <span className="text-xs text-zinc-500">
                  {CARTA_STATUS_LABELS[c.status] ?? c.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-400">{c.administradora ?? "Administradora"}</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Crédito</dt>
                  <dd className="font-semibold text-white">
                    {c.credito != null ? formatCurrency(Number(c.credito)) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Entrada</dt>
                  <dd>{c.entrada != null ? formatCurrency(Number(c.entrada)) : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Parcela</dt>
                  <dd className="text-amber-400/90">
                    {c.valor_parcela != null ? formatCurrency(Number(c.valor_parcela)) : "—"}
                  </dd>
                </div>
              </dl>
              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <Link
                  href="/cartas-contempladas"
                  className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  Tenho interesse
                </Link>
                <Link
                  href="/cartas-contempladas"
                  className="rounded-full border border-zinc-600 px-4 py-2 text-xs font-medium text-zinc-300 hover:border-zinc-500"
                >
                  Ver detalhes
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-8">
        <HomeCtaLink href="/cartas-contempladas" variant="outline">
          Ver todas as cartas
        </HomeCtaLink>
      </div>
    </HomeSection>
  );
}
