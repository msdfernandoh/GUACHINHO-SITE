import Image from "next/image";
import Link from "next/link";
import type { SiteConfig } from "@/lib/config/defaults";
import { HOME_MEDIA } from "@/lib/home/home-media";
import { HomeCtaLink } from "./home-section";

type Props = { site: SiteConfig };

const FLOATERS = [
  { label: "Consultoria", value: "Humana e estratégica" },
  { label: "Simulações", value: "Personalizadas" },
  { label: "Comparativo", value: "Consórcio e crédito" },
] as const;

export function HomeHeroPremium({ site }: Props) {
  const brand = site.nomeEmpresa?.trim() || "Gauchinho Escritório de Soluções Financeiras";

  return (
    <section className="relative min-h-[88vh] overflow-hidden border-b border-zinc-800/60">
      <div className="pointer-events-none absolute inset-0 bg-zinc-950" aria-hidden />
      <Image
        src={HOME_MEDIA.poster}
        alt=""
        fill
        priority
        className="object-cover object-center opacity-35 mix-blend-luminosity"
        sizes="100vw"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-950/30 via-zinc-950/85 to-zinc-950"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(245,158,11,0.22),transparent_65%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 top-24 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl"
        style={{ animation: "home-glow-pulse 8s ease-in-out infinite" }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -left-24 bottom-10 h-72 w-72 rounded-full bg-amber-600/8 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-14 px-4 pb-20 pt-16 sm:px-6 md:pt-24 lg:flex-row lg:items-end lg:gap-10">
        <div className="max-w-3xl flex-1">
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-zinc-950/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-400/95 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
            {brand}
          </p>
          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-[3.4rem]">
            Qual sonho você quer{" "}
            <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">
              realizar?
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300 md:text-xl">
            Consórcio, financiamento e oportunidades inteligentes para você conquistar imóveis,
            veículos e grandes projetos com planejamento, segurança e estratégia.
          </p>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-500 md:text-base">
            Atendimento consultivo. Simulações personalizadas. Estratégias de lance e comparação
            financeira.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <HomeCtaLink href="/simulador">Simular agora</HomeCtaLink>
            <HomeCtaLink href="/grupos" variant="outline">
              Ver grupos disponíveis
            </HomeCtaLink>
            <HomeCtaLink href="/oportunidades-imobiliarias" variant="outline">
              Ver oportunidades imobiliárias
            </HomeCtaLink>
          </div>
        </div>

        <div className="relative w-full max-w-md shrink-0 lg:max-w-sm xl:max-w-md">
          <div className="home-gold-glow relative overflow-hidden rounded-3xl border border-amber-500/20 bg-zinc-950/50 p-1 backdrop-blur-sm">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.35rem]">
              <Image
                src={HOME_MEDIA.poster}
                alt="Campanha Gauchinho"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 90vw, 400px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
              <p className="absolute bottom-4 left-4 right-4 text-sm font-medium text-zinc-200">
                Soluções financeiras com identidade gaúcha e padrão de grande escritório.
              </p>
            </div>
          </div>
          <div className="absolute -left-6 top-8 hidden w-44 rounded-2xl border border-zinc-700/80 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-md lg:block">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500">Passo 01</p>
            <p className="mt-1 text-sm font-semibold text-white">Diagnóstico</p>
            <p className="mt-1 text-xs text-zinc-500">Objetivo, prazo e capacidade.</p>
          </div>
        </div>
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-4 px-4 pb-16 sm:px-6 md:grid-cols-3">
        {FLOATERS.map((f, i) => (
          <div
            key={f.label}
            className="rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-5 backdrop-blur-md transition duration-300 hover:border-amber-500/35 hover:bg-zinc-900/70"
            style={{ transform: `translateY(${i === 1 ? "-4px" : "0"})` }}
          >
            <p className="text-xs font-bold uppercase tracking-wider text-amber-500">{f.label}</p>
            <p className="mt-2 text-base font-semibold text-white">{f.value}</p>
          </div>
        ))}
      </div>

      <p className="sr-only">
        <Link href="/login">Área admin</Link>
      </p>
    </section>
  );
}
