"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calculator,
  ChevronRight,
  Percent,
  PieChart,
  Shield,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { HomeReveal } from "./home-reveal";

const C = {
  bg: "#07111F",
  bgCard: "#0D1E33",
  bgMid: "#0A1628",
  gold: "#C9A84C",
  goldLight: "#F0D080",
  muted: "#94A3B8",
  border: "#1E3A5F",
  goldBorder: "rgba(201,168,76,0.3)",
} as const;

const BENEFITS = [
  { Icon: BarChart3, text: "CDI, Selic, Poupança e Tesouro" },
  { Icon: Building2, text: "Reajuste de aluguel por índices reais" },
  { Icon: Percent, text: "Taxa real do financiamento" },
  { Icon: PieChart, text: "Comparação de investimentos e rentabilidade" },
] as const;

const CALC_PRIMARY_HREF = "/calculadoras?calc=aplicacao_mensal";
const CALC_SECONDARY_HREF = "/calculadoras";

function trackHomeCalculadorasClick(cta: "usar_calculadoras_agora" | "ver_calculadoras") {
  void fetch("/api/public/eventos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tipo_evento: "clique_home_calculadoras",
      origem: "home",
      dados_evento: {
        secao: "calculadoras_financeiras",
        cta,
      },
    }),
  });
}

function PromoVisual() {
  const tabs = [
    { label: "Índices", active: true },
    { label: "Financiamento", active: false },
    { label: "Aluguel", active: false },
    { label: "Investimentos", active: false },
  ];

  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      <div
        className="pointer-events-none absolute -left-6 top-1/2 hidden h-40 w-40 -translate-y-1/2 rounded-full opacity-40 blur-3xl lg:block"
        style={{ background: C.gold }}
        aria-hidden
      />
      <HomeReveal delayMs={120}>
        <div
          className="relative overflow-hidden rounded-3xl border p-5 shadow-2xl shadow-black/40 sm:p-6"
          style={{ background: C.bgCard, borderColor: C.goldBorder }}
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-white">Calculadoras Financeiras</p>
            <Calculator className="h-5 w-5 shrink-0" style={{ color: C.gold }} aria-hidden />
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {tabs.map((t) => (
              <span
                key={t.label}
                className="rounded-lg px-2.5 py-1 text-[10px] font-semibold sm:text-xs"
                style={{
                  background: t.active ? "rgba(201,168,76,0.2)" : "rgba(30,58,95,0.5)",
                  color: t.active ? C.goldLight : C.muted,
                  border: `1px solid ${t.active ? C.goldBorder : C.border}`,
                }}
              >
                {t.label}
              </span>
            ))}
          </div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
            Rentabilidade acumulada
          </p>
          <div
            className="relative h-28 rounded-xl border sm:h-32"
            style={{ background: C.bgMid, borderColor: C.border }}
          >
            <svg viewBox="0 0 320 100" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
              <polyline
                fill="none"
                stroke={C.gold}
                strokeWidth="2.5"
                points="0,85 40,78 80,70 120,58 160,52 200,42 240,35 280,22 320,12"
              />
              <polyline
                fill="none"
                stroke="#60A5FA"
                strokeWidth="1.5"
                opacity="0.7"
                points="0,90 40,86 80,82 120,76 160,70 200,65 240,58 280,50 320,44"
              />
            </svg>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1 text-[9px] sm:text-[10px]" style={{ color: C.muted }}>
            {["Mai", "Jul", "Set", "Nov", "Jan", "Mar"].map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>
      </HomeReveal>

      <HomeReveal delayMs={200} className="absolute -right-2 top-2 z-10 hidden w-[11.5rem] sm:block lg:-right-4">
        <div
          className="rounded-2xl border p-3 shadow-xl"
          style={{ background: C.bgCard, borderColor: C.goldBorder }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.gold }}>
            Índices em destaque
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-white">
            <li className="flex justify-between gap-2">
              <span style={{ color: C.muted }}>CDI</span>
              <span style={{ color: C.goldLight }}>14,15%</span>
            </li>
            <li className="flex justify-between gap-2">
              <span style={{ color: C.muted }}>Selic</span>
              <span style={{ color: C.goldLight }}>14,25%</span>
            </li>
            <li className="flex justify-between gap-2">
              <span style={{ color: C.muted }}>Poupança</span>
              <span style={{ color: C.goldLight }}>0,58% a.m.</span>
            </li>
          </ul>
        </div>
      </HomeReveal>

      <HomeReveal delayMs={280} className="absolute -right-1 top-[42%] z-10 hidden w-[10.5rem] sm:block">
        <div
          className="flex items-center gap-2 rounded-2xl border p-3 shadow-xl"
          style={{ background: C.bgCard, borderColor: C.goldBorder }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: "rgba(201,168,76,0.15)" }}
          >
            <Percent className="h-5 w-5" style={{ color: C.gold }} />
          </div>
          <div>
            <p className="text-[10px]" style={{ color: C.muted }}>
              Taxa real estimada
            </p>
            <p className="text-lg font-black text-white">7,23%</p>
          </div>
        </div>
      </HomeReveal>

      <HomeReveal delayMs={360} className="absolute -right-3 bottom-0 z-10 hidden w-[12rem] sm:block lg:-right-6">
        <div
          className="flex items-center gap-2 rounded-2xl border p-3 shadow-xl"
          style={{ background: C.bgCard, borderColor: C.goldBorder }}
        >
          <TrendingUp className="h-8 w-8 shrink-0" style={{ color: C.gold }} />
          <div>
            <p className="text-[10px]" style={{ color: C.muted }}>
              Valor futuro estimado
            </p>
            <p className="text-sm font-bold text-white">R$ 126.780,43</p>
          </div>
        </div>
      </HomeReveal>
    </div>
  );
}

export function FinancialCalculatorsPromo() {
  return (
    <section
      className="relative overflow-hidden border-y px-4 py-14 sm:px-6 sm:py-16 lg:px-16"
      style={{ background: C.bg, borderColor: C.border }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 70% 50%, rgba(201,168,76,0.12), transparent 60%)",
        }}
        aria-hidden
      />
      <div className="container relative mx-auto grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
        <HomeReveal>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: C.gold }}>
            <Sparkles className="h-4 w-4" aria-hidden />
            Ferramenta inteligente
          </div>
          <h2 className="mt-4 font-serif text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[2.65rem]">
            Calculadoras Financeiras
            <span className="mt-1 block font-serif text-3xl sm:text-4xl lg:text-[2.65rem]" style={{ color: C.goldLight }}>
              para usar sempre
            </span>
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: C.muted }}>
            Compare índices, reajuste aluguel, descubra a taxa real do financiamento, simule rendimentos e
            encontre a melhor estratégia para o seu dinheiro.
          </p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {BENEFITS.map(({ Icon, text }, i) => (
              <HomeReveal key={text} delayMs={i * 60}>
                <li
                  className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium text-white"
                  style={{ background: "rgba(201,168,76,0.06)", borderColor: C.goldBorder }}
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color: C.gold }} aria-hidden />
                  <span className="leading-snug">{text}</span>
                </li>
              </HomeReveal>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href={CALC_PRIMARY_HREF}
              onClick={() => trackHomeCalculadorasClick("usar_calculadoras_agora")}
              className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-bold transition hover:brightness-110"
              style={{
                background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight}, ${C.gold})`,
                color: C.bg,
              }}
            >
              <Calculator className="h-5 w-5" aria-hidden />
              Usar calculadoras agora
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href={CALC_SECONDARY_HREF}
              onClick={() => trackHomeCalculadorasClick("ver_calculadoras")}
              className="inline-flex min-h-12 items-center justify-center gap-1 rounded-xl border px-6 text-base font-semibold text-white transition hover:bg-white/5"
              style={{ borderColor: C.goldBorder }}
            >
              Ver calculadoras
              <ChevronRight className="h-5 w-5" style={{ color: C.gold }} aria-hidden />
            </Link>
          </div>
          <p className="mt-6 flex items-start gap-2 text-sm" style={{ color: C.gold }}>
            <Shield className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Ideal para consultar antes de financiar, investir ou fechar negócio.
          </p>
        </HomeReveal>

        <div className="relative min-h-[12rem] pb-4 lg:min-h-0 lg:pb-0">
          <Image
            src="/images/calculadoras-financeiras-home.png"
            alt="Painel ilustrativo das calculadoras financeiras com índices, gráficos e simulações"
            width={720}
            height={520}
            className="hidden w-full rounded-3xl border shadow-2xl shadow-black/50 lg:block"
            style={{ borderColor: C.goldBorder }}
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
          <div className="lg:hidden">
            <PromoVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
