import Link from "next/link";
import type { CartaContemplada } from "@/lib/cartas/types";
import { CARTA_STATUS_LABELS, CARTA_TIPOS } from "@/lib/cartas/types";
import { formatCurrency } from "@/lib/utils/format";
import { HomeReveal } from "./home-reveal";
import { HomeCtaLink, HomeSection } from "./home-section";

export function FeaturedLettersSection({ cartas }: { cartas: CartaContemplada[] }) {
  if (!cartas.length) return null;

  return (
    <HomeSection
      eyebrow="Cartas"
      title="Cartas contempladas em destaque"
      subtitle="Oportunidades ativas — detalhes e interesse na vitrine completa."
    >
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {cartas.map((c, i) => {
          const tipo = CARTA_TIPOS.find((t) => t.value === c.tipo_carta)?.label ?? c.tipo_carta;
          return (
            <HomeReveal key={c.id} delayMs={i * 60}>
              <article className="flex h-full flex-col rounded-3xl border border-zinc-800/90 bg-zinc-950/80 p-6 shadow-xl shadow-black/20 transition hover:border-amber-500/35">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
                    {tipo}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {CARTA_STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{c.administradora ?? "Administradora"}</p>
                <dl className="mt-5 space-y-2 text-sm">
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
                    <dd className="font-semibold text-amber-400">
                      {c.valor_parcela != null ? formatCurrency(Number(c.valor_parcela)) : "—"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-auto flex flex-wrap gap-2 pt-6">
                  <Link
                    href="/cartas-contempladas"
                    className="rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-5 py-2.5 text-xs font-bold text-zinc-950 hover:brightness-105"
                  >
                    Tenho interesse
                  </Link>
                </div>
              </article>
            </HomeReveal>
          );
        })}
      </div>
      <div className="mt-10">
        <HomeCtaLink href="/cartas-contempladas" variant="outline">
          Ver todas as cartas
        </HomeCtaLink>
      </div>
    </HomeSection>
  );
}
