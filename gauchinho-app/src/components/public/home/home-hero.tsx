import Link from "next/link";
import type { SiteConfig } from "@/lib/config/defaults";
import { HomeCtaLink } from "./home-section";

type Props = { site: SiteConfig };

export function HomeHero({ site }: Props) {
  const brand = site.nomeEmpresa?.trim() || "Gauchinho Escritório de Soluções Financeiras";

  return (
    <section className="relative overflow-hidden border-b border-zinc-800/80">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(245,158,11,0.18),transparent)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute -right-24 top-20 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-amber-600/5 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">{brand}</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
          Qual sonho você quer realizar?
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-400 md:text-xl">
          Consórcio, financiamento e crédito com orientação especializada para você escolher o
          melhor caminho.
        </p>
        <p className="mt-3 max-w-xl text-sm text-zinc-500">
          Encontre a melhor solução financeira para realizar seu sonho.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <HomeCtaLink href="/simulador">Simular agora</HomeCtaLink>
          <HomeCtaLink href="/grupos" variant="outline">
            Ver grupos disponíveis
          </HomeCtaLink>
          <HomeCtaLink href="/oportunidades-imobiliarias" variant="outline">
            Ver oportunidades imobiliárias
          </HomeCtaLink>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            { n: "01", t: "Diagnóstico", d: "Entendemos seu objetivo e capacidade." },
            { n: "02", t: "Comparativo", d: "Consórcio, financiamento e cartas." },
            { n: "03", t: "Acompanhamento", d: "Do simulador à proposta e execução." },
          ].map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-5 backdrop-blur-sm transition hover:border-amber-500/30"
            >
              <span className="text-xs font-bold text-amber-500">{s.n}</span>
              <p className="mt-2 font-semibold text-white">{s.t}</p>
              <p className="mt-1 text-sm text-zinc-500">{s.d}</p>
            </div>
          ))}
        </div>
        {site.descricaoInstitucional ? (
          <p className="mt-8 text-sm text-zinc-500">{site.descricaoInstitucional}</p>
        ) : null}
        <p className="mt-6 text-sm text-zinc-600">
          <Link href="/login" className="hover:text-zinc-400">
            Área admin
          </Link>
        </p>
      </div>
    </section>
  );
}
