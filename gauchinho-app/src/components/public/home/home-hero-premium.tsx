import Image from "next/image";
import Link from "next/link";
import { Sparkles, TrendingUp, ShieldCheck, Users } from "lucide-react";
import type { SiteConfig } from "@/lib/config/defaults";
import { HOME_MEDIA } from "@/lib/home/home-media";
import { HomeCtaLink } from "./home-section";
import { HeroTitleAnimated } from "./hero-title-animated";

type Props = { site: SiteConfig };

const STATS = [
  { icon: Users, label: "Clientes atendidos", value: "+500" },
  { icon: TrendingUp, label: "Em crédito gerenciado", value: "R$ 80M+" },
  { icon: ShieldCheck, label: "Anos de experiência", value: "10+" },
] as const;

export function HomeHeroPremium({ site }: Props) {
  const brand = site.nomeEmpresa?.trim() || "Gauchinho Escritório de Soluções Financeiras";

  return (
    <section className="relative min-h-screen overflow-hidden border-b border-zinc-800/60">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0 bg-zinc-950" aria-hidden />
      <Image
        src={HOME_MEDIA.poster}
        alt=""
        fill
        priority
        className="object-cover object-center opacity-20 mix-blend-luminosity"
        sizes="100vw"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-950/20 via-zinc-950/80 to-zinc-950"
        aria-hidden
      />
      {/* Radial amber glow — bigger and more visible */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-5%,rgba(245,158,11,0.32),transparent_65%)]"
        aria-hidden
      />
      {/* Orbs */}
      <div
        className="pointer-events-none absolute -right-32 top-24 h-[500px] w-[500px] rounded-full bg-amber-500/12 blur-[100px]"
        style={{ animation: "home-glow-pulse 8s ease-in-out infinite" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-40 bottom-0 h-96 w-96 rounded-full bg-amber-600/10 blur-[80px]"
        aria-hidden
      />

      {/* Main content */}
      <div className="relative mx-auto flex max-w-7xl flex-col gap-14 px-4 pb-20 pt-20 sm:px-6 md:pt-32 lg:flex-row lg:items-center lg:gap-16">
        {/* Left — text */}
        <div className="max-w-3xl flex-1">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300">
              {brand}
            </span>
          </div>

          {/* Animated headline */}
          <HeroTitleAnimated />

          <p className="mt-7 max-w-2xl text-xl leading-relaxed text-zinc-300 md:text-2xl">
            Consórcio, financiamento e oportunidades inteligentes para conquistar imóveis, veículos e
            grandes projetos com planejamento e estratégia.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <HomeCtaLink href="/simulador">Simular agora</HomeCtaLink>
            <HomeCtaLink href="/grupos" variant="outline">
              Ver grupos disponíveis
            </HomeCtaLink>
            <HomeCtaLink href="/oportunidades-imobiliarias" variant="outline">
              Oportunidades imobiliárias
            </HomeCtaLink>
          </div>

          {/* Stats row */}
          <div className="mt-12 flex flex-wrap gap-8 border-t border-zinc-800/60 pt-8">
            {STATS.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                  <Icon className="h-5 w-5 text-amber-400" aria-hidden />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-xs text-zinc-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — image card */}
        <div className="relative w-full max-w-md shrink-0 lg:max-w-sm xl:max-w-[420px]">
          <div className="home-gold-glow relative overflow-hidden rounded-[2rem] border border-amber-500/25 bg-zinc-950/50 p-1.5 shadow-2xl shadow-amber-500/10 backdrop-blur-sm">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.6rem]">
              <Image
                src={HOME_MEDIA.poster}
                alt="Campanha Gauchinho"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 90vw, 420px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
              <p className="absolute bottom-5 left-5 right-5 text-sm font-medium leading-relaxed text-zinc-200">
                Soluções financeiras com identidade gaúcha e padrão de grande escritório.
              </p>
            </div>
          </div>
          {/* Floating card */}
          <div className="absolute -left-6 top-10 hidden w-48 rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md lg:block">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Passo 01</p>
            <p className="mt-1 text-sm font-semibold text-white">Diagnóstico</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">Objetivo, prazo e capacidade.</p>
          </div>
        </div>
      </div>

      <p className="sr-only">
        <Link href="/login">Área admin</Link>
      </p>
    </section>
  );
}
