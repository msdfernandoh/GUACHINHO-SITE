"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Brain, Target, BarChart2, FileText,
  Home, Car, Bike, Truck, Tractor,
  Shield, Trophy, Wallet, BadgeCheck,
  ChevronLeft, ChevronRight, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import {
  computeQuickSimulatorParcela,
  type SimuladorConfigsBundle,
} from "@/lib/simulador/preview-home";
import type { HomeConteudoDestaques } from "@/lib/home/load-home-data";
import { FeaturedCasosSection } from "@/components/public/home/featured-casos-section";
import { FeaturedDicasSection } from "@/components/public/home/featured-dicas-section";
import { FeaturedParceirosCmsSection } from "@/components/public/home/featured-parceiros-cms-section";

const C = {
  bg:         "#07111F",
  bgCard:     "#0D1E33",
  bgMid:      "#0A1628",
  gold:       "#C9A84C",
  goldLight:  "#F0D080",
  text:       "#FFFFFF",
  muted:      "#94A3B8",
  border:     "#1E3A5F",
  goldBorder: "rgba(201,168,76,0.3)",
} as const;

// ─── CATEGORIAS ────────────────────────────────────────────
// Arquivo da foto aparece como legenda — troque o arquivo para atualizar
const SONHOS = [
  {
    id: "casa",
    icon: Home,
    num: "01",
    title: "Casa",
    sub: "Imóvel residencial",
    legenda: "Casa.png",
    desc: "Planejamento sob medida para conquistar a casa dos sonhos com estratégias de lance e parcelas que cabem no seu bolso.",
    img: "/foto/Casa.png",
    href: "/simulador?solucao=consorcio&tipo=imovel",
    stat: { value: "220", label: "meses de prazo" },
  },
  {
    id: "apartamento",
    icon: Home,
    num: "02",
    title: "Apartamento",
    sub: "Imóvel urbano",
    legenda: "apartamento.jpg",
    desc: "Apartamentos com crédito planejado e sem juros. Consultoria completa para encontrar o grupo ideal para o seu momento.",
    img: "/foto/apartamento.jpg",
    href: "/simulador?solucao=consorcio&tipo=imovel",
    stat: { value: "R$ 80M+", label: "em crédito gerenciado" },
  },
  {
    id: "casa-popular",
    icon: Home,
    num: "03",
    title: "Casa Popular",
    sub: "Primeira moradia",
    legenda: "Casa-Popular.png",
    desc: "Realize o sonho da primeira moradia com parcelas acessíveis. Grupos especiais e estratégia de lance para contemplação rápida.",
    img: "/foto/Casa-Popular.png",
    href: "/simulador?solucao=consorcio&tipo=imovel",
    stat: { value: "+500", label: "clientes atendidos" },
  },
  {
    id: "carros",
    icon: Car,
    num: "04",
    title: "Carros",
    sub: "Veículos novos e seminovos",
    legenda: "Carros.png",
    desc: "Seu próximo carro com parcelas planejadas, sem juros abusivos. Comparativo financeiro completo entre consórcio e financiamento.",
    img: "/foto/Carros.png",
    href: "/simulador?solucao=consorcio&tipo=automovel",
    stat: { value: "100%", label: "do crédito para compra" },
  },
  {
    id: "motos",
    icon: Bike,
    num: "05",
    title: "Motos",
    sub: "Mobilidade com planejamento",
    legenda: "motos.png",
    desc: "Mobilidade com crédito planejado e consultoria de lance. Encontre o grupo certo para o seu objetivo com atendimento personalizado.",
    img: "/foto/motos.png",
    href: "/simulador?tipo=moto&solucao=consorcio",
    stat: { value: "0%", label: "de juros no consórcio" },
  },
  {
    id: "frota",
    icon: Truck,
    num: "06",
    title: "Caminhões e Frota",
    sub: "Transporte profissional",
    legenda: "Caminhoes-e-Frota.png",
    desc: "Frota e transporte com análise patrimonial e comparativo financeiro. Propostas em PDF para compartilhar com sócios e contador.",
    img: "/foto/Caminhoes-e-Frota.png",
    href: "/simulador?tipo=caminhao&solucao=consorcio",
    stat: { value: "10+", label: "anos de experiência" },
  },
  {
    id: "maquinas-agricolas",
    icon: Tractor,
    num: "07",
    title: "Máquinas Agrícolas",
    sub: "Agronegócio e campo",
    legenda: "Maquinas-Agricolas.png",
    desc: "Colheitadeiras, tratores e equipamentos do campo com crédito planejado. Consultoria especializada para o agronegócio.",
    img: "/foto/Maquinas-Agricolas.png",
    href: "/simulador?tipo=maquinario&solucao=consorcio",
    stat: { value: "220", label: "meses de prazo" },
  },
  {
    id: "maquinas-pesadas",
    icon: Tractor,
    num: "08",
    title: "Máquinas Pesadas",
    sub: "Construção e obra",
    legenda: "Maquinas-Pesadas.png",
    desc: "Equipamentos pesados para construção civil e mineração com análise de crédito profissional e estratégias de lance.",
    img: "/foto/Maquinas-Pesadas.png",
    href: "/simulador?tipo=maquinario&solucao=consorcio",
    stat: { value: "R$ 80M+", label: "em crédito gerenciado" },
  },
];

const FALAS = [
  "Sem juros é consórcio! 🤝",
  "Realize o sonho da casa própria! 🏠",
  "Seu carro novo sem entrada! 🚗",
  "Contemplação por sorteio ou lance! ⭐",
  "Planejamento que cabe no bolso! 💰",
  "A gente te ajuda a conquistar! 🏆",
];

const DIFERENCIAIS = [
  { icon: Brain,     titulo: "Atendimento consultivo",    desc: "Especialistas que traduzem números em decisões claras para o seu momento." },
  { icon: Target,    titulo: "Estratégias de lance",      desc: "Cenários de lance embutido e livre para enxergar risco e oportunidade." },
  { icon: BarChart2, titulo: "Consórcio × Financiamento", desc: "Comparativo financeiro lado a lado, sem jargão e sem promessa vazia." },
  { icon: FileText,  titulo: "Propostas em PDF",          desc: "Material profissional para compartilhar com família, sócios ou contador." },
];

const BADGES = [
  { icon: BadgeCheck, texto: "Sem juros é consórcio!" },
  { icon: Wallet,     texto: "Parcelas que cabem no bolso" },
  { icon: Trophy,     texto: "Contemplação por lance ou sorteio" },
  { icon: Shield,     texto: "Segurança e transparência" },
];

const GRUPOS = [
  { nome: "Grupo 1473", tipo: "Imóvel", credito: "R$ 450.000",   parcela: "R$ 1.546,36", prazo: "220 meses" },
  { nome: "Grupo 1503", tipo: "Imóvel", credito: "R$ 1.102.500", parcela: "R$ 3.698,39", prazo: "220 meses" },
  { nome: "Grupo 1513", tipo: "Imóvel", credito: "R$ 1.050.000", parcela: "R$ 2.863,64", prazo: "220 meses" },
  { nome: "Grupo 1533", tipo: "Imóvel", credito: "R$ 1.500.000", parcela: "R$ 5.339,71", prazo: "220 meses" },
];

// ─── SEÇÃO OBJETIVOS CINEMATOGRÁFICA ──────────────────────
function ObjetivosSection() {
  const shouldReduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = (next: number, direction: number) => {
    setPrev(active);
    setDir(direction);
    setActive(next);
  };

  const goNext = () => go((active + 1) % SONHOS.length, 1);
  const goPrev = () => go((active - 1 + SONHOS.length) % SONHOS.length, -1);

  useEffect(() => {
    if (paused || shouldReduce) return;
    timerRef.current = setInterval(goNext, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [active, paused, shouldReduce]);

  const item = SONHOS[active]!;
  const Icon = item.icon;

  const imgVariants = {
    enter: (d: number) => ({ opacity: 0, scale: 1.08, x: d * 60 }),
    center: { opacity: 1, scale: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
    exit:  (d: number) => ({ opacity: 0, scale: 0.96, x: d * -60, transition: { duration: 0.4 } }),
  };

  const contentVariants = {
    enter: (d: number) => ({ opacity: 0, x: d * 40, y: 10 }),
    center: { opacity: 1, x: 0, y: 0, transition: { duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] as const } },
    exit:  (d: number) => ({ opacity: 0, x: d * -30, transition: { duration: 0.3 } }),
  };

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: C.bg }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Fundo de imagem com transição */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence custom={dir} initial={false}>
          <motion.div
            key={`bg-${active}`}
            className="absolute inset-0"
            custom={dir}
            variants={imgVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <img
              src={item.img}
              alt=""
              aria-hidden
              className="h-full w-full object-cover"
            />
            {/* Overlay: lado esquerdo mais claro para a imagem aparecer */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(
                  100deg,
                  rgba(7,17,31,0.72) 0%,
                  rgba(7,17,31,0.45) 40%,
                  rgba(7,17,31,0.18) 70%,
                  rgba(7,17,31,0.05) 100%
                )`,
              }}
            />
            {/* Sombra no rodapé para legibilidade */}
            <div
              className="absolute inset-x-0 bottom-0 h-40"
              style={{ background: "linear-gradient(to top, rgba(7,17,31,0.85), transparent)" }}
            />
          </motion.div>
        </AnimatePresence>

        {/* Linha de scan animada */}
        {!shouldReduce && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 h-[2px] z-10"
            style={{ background: `linear-gradient(to right, transparent, ${C.gold}, transparent)`, opacity: 0.4 }}
            animate={{ top: ["0%", "100%"] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            aria-hidden
          />
        )}

        {/* Grid lines decorativas */}
        <div
          className="pointer-events-none absolute inset-0 z-10 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(${C.gold} 1px, transparent 1px), linear-gradient(90deg, ${C.gold} 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
          aria-hidden
        />
      </div>

      {/* Conteúdo */}
      <div className="relative z-20 container mx-auto px-4 py-20 sm:px-6 lg:px-16">

        {/* Header fixo */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: C.gold }}>
              Escolha seu objetivo
            </p>
            <h2 className="text-4xl font-black text-white lg:text-5xl xl:text-6xl">
              Qual sonho você quer{" "}
              <span style={{ color: C.gold }}>realizar?</span>
            </h2>
          </div>

          {/* Controles */}
          <div className="hidden items-center gap-3 lg:flex">
            <button
              type="button"
              onClick={goPrev}
              className="flex h-11 w-11 items-center justify-center rounded-full border transition-all hover:border-[#C9A84C] hover:text-[#C9A84C]"
              style={{ borderColor: C.border, color: C.muted, background: "rgba(13,30,51,0.8)" }}
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-bold tabular-nums" style={{ color: C.muted }}>
              {String(active + 1).padStart(2, "0")} / {String(SONHOS.length).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={goNext}
              className="flex h-11 w-11 items-center justify-center rounded-full border transition-all hover:border-[#C9A84C] hover:text-[#C9A84C]"
              style={{ borderColor: C.border, color: C.muted, background: "rgba(13,30,51,0.8)" }}
              aria-label="Próximo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Layout principal */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">

          {/* Esquerda — conteúdo flutuante SOBRE a imagem, sem caixa opaca */}
          <div className="relative min-h-[340px] flex flex-col justify-end pb-2">

            <AnimatePresence custom={dir} mode="wait">
              <motion.div
                key={`content-${active}`}
                custom={dir}
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {/* Número + ícone */}
                <div className="mb-5 flex items-center gap-3">
                  <span
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-lg font-black"
                    style={{
                      background: "rgba(7,17,31,0.6)",
                      border: `1.5px solid ${C.goldBorder}`,
                      color: C.gold,
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    {item.num}
                  </span>
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      background: "rgba(7,17,31,0.6)",
                      border: `1px solid ${C.goldBorder}`,
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <Icon className="h-5 w-5" style={{ color: C.gold }} />
                  </div>
                </div>

                <h3
                  className="mb-1 text-5xl font-black text-white lg:text-6xl"
                  style={{ textShadow: "0 2px 24px rgba(0,0,0,0.8), 0 0 60px rgba(0,0,0,0.5)" }}
                >
                  {item.title}
                </h3>
                <p className="mb-1 text-base font-semibold" style={{ color: C.gold, textShadow: "0 1px 8px rgba(0,0,0,0.9)" }}>
                  {item.sub}
                </p>
                {"legenda" in item && (
                  <p className="mb-4 font-mono text-xs" style={{ color: "rgba(201,168,76,0.6)", textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>
                    📁 {(item as typeof item & { legenda: string }).legenda}
                  </p>
                )}
                <p
                  className="mb-8 max-w-lg text-base leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.85)", textShadow: "0 1px 12px rgba(0,0,0,0.9)" }}
                >
                  {item.desc}
                </p>

                {/* CTA */}
                <motion.div whileHover={shouldReduce ? undefined : { scale: 1.03 }} whileTap={shouldReduce ? undefined : { scale: 0.97 }}>
                  <Link
                    href={item.href}
                    className="group inline-flex items-center gap-3 rounded-2xl px-8 py-4 text-base font-black"
                    style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight}, ${C.gold})`, color: C.bg }}
                  >
                    Simular {item.title}
                    <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </motion.div>
              </motion.div>
            </AnimatePresence>

            {/* Barra de progresso na base */}
            <div className="mt-8 h-[3px] w-full overflow-hidden rounded-full"
              style={{ background: "rgba(201,168,76,0.15)" }}>
              {!shouldReduce && (
                <motion.div
                  key={`bar-${active}`}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(to right, ${C.gold}, ${C.goldLight})` }}
                  initial={{ width: "0%" }}
                  animate={{ width: paused ? undefined : "100%" }}
                  transition={{ duration: 4, ease: "linear" }}
                />
              )}
            </div>
          </div>

          {/* Direita — tabs de categoria */}
          <div className="flex flex-col gap-2">
            {SONHOS.map((s, i) => {
              const SIcon = s.icon;
              const isOn = i === active;
              return (
                <motion.button
                  key={s.id}
                  type="button"
                  onClick={() => go(i, i > active ? 1 : -1)}
                  whileHover={shouldReduce ? undefined : { x: isOn ? 0 : 4 }}
                  className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200"
                  style={{
                    background: isOn ? "rgba(201,168,76,0.1)" : "rgba(13,30,51,0.6)",
                    borderColor: isOn ? C.gold : C.border,
                    boxShadow: isOn ? `0 0 20px rgba(201,168,76,0.15)` : "none",
                  }}
                  aria-current={isOn ? "true" : undefined}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: isOn ? `rgba(201,168,76,0.18)` : "rgba(30,58,95,0.5)",
                      color: isOn ? C.gold : C.muted,
                    }}
                  >
                    <SIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold" style={{ color: isOn ? "#fff" : C.muted }}>
                      {s.title}
                    </p>
                    <p className="truncate text-xs" style={{ color: isOn ? C.gold : "#4A6580" }}>
                      {s.sub}
                    </p>
                  </div>
                  {isOn && (
                    <motion.div
                      layoutId="arrow-indicator"
                      className="shrink-0"
                      style={{ color: C.gold }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Dots mobile */}
        <div className="mt-6 flex items-center justify-center gap-2 lg:hidden">
          {SONHOS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i, i > active ? 1 : -1)}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: i === active ? "24px" : "8px",
                background: i === active ? C.gold : "rgba(201,168,76,0.25)",
              }}
              aria-label={s.title}
            />
          ))}
          <button type="button" onClick={goPrev} className="ml-2" style={{ color: C.muted }} aria-label="Anterior">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={goNext} style={{ color: C.muted }} aria-label="Próximo">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────
export type HomeV2ClientProps = {
  simuladorConfigs: SimuladorConfigsBundle;
  conteudoDestaques: HomeConteudoDestaques;
};

export function HomeV2Client({ simuladorConfigs, conteudoDestaques }: HomeV2ClientProps) {
  const shouldReduce = useReducedMotion();
  const [fraseAtual, setFraseAtual] = useState(0);
  const [tabSimulador, setTabSimulador] = useState<"consorcio" | "financiamento">("consorcio");
  const [valorCredito, setValorCredito] = useState(300000);
  const [prazo, setPrazo] = useState(100);
  const [mascoteError, setMascoteError] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setFraseAtual((p) => (p + 1) % FALAS.length), 3000);
    return () => clearInterval(t);
  }, []);

  const parcelaNum = useMemo(() => {
    const n = computeQuickSimulatorParcela(
      tabSimulador,
      valorCredito,
      prazo,
      simuladorConfigs,
      "imovel",
    );
    return n.toFixed(2);
  }, [tabSimulador, valorCredito, prazo, simuladorConfigs]);

  const parcela = parcelaNum.replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const fadeUp = {
    hidden: shouldReduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 },
    visible: {
      opacity: 1, y: 0,
      transition: { duration: shouldReduce ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  return (
    <main style={{ background: C.bg, color: C.text, fontFamily: "inherit" }}>

      {/* ══════════════════════════════════════════
          SEÇÃO 1 — OBJETIVOS CINEMATOGRÁFICOS
      ══════════════════════════════════════════ */}
      <ObjetivosSection />

      {/* ══════════════════════════════════════════
          SEÇÃO 2 — MASCOTE + COPY HERO
      ══════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-16"
        style={{ background: `linear-gradient(135deg, ${C.bg} 0%, ${C.bgCard} 60%, ${C.bg} 100%)` }}
      >
        <div
          className="pointer-events-none absolute right-1/4 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full opacity-[0.08] blur-3xl"
          style={{ background: `radial-gradient(circle, ${C.gold}, transparent)` }}
          aria-hidden
        />

        <div className="container mx-auto flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16">

          {/* Esquerda — copy */}
          <div className="flex-1 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: C.goldBorder, color: C.gold, background: "rgba(201,168,76,0.08)" }}
            >
              ★ Gauchinho Escritório de Soluções Financeiras
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              className="mb-5 text-4xl font-black leading-tight text-white lg:text-5xl xl:text-6xl"
            >
              Planejamento com{" "}
              <span style={{ color: C.gold }}>identidade gaúcha</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.6 }}
              className="mb-8 max-w-lg text-lg leading-relaxed"
              style={{ color: C.muted }}
            >
              Consórcio, financiamento e oportunidades inteligentes. Simulações personalizadas,
              estratégias de lance e comparativos financeiros com atendimento consultivo real.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex flex-wrap justify-center gap-3 lg:justify-start"
            >
              <motion.div whileHover={shouldReduce ? undefined : { scale: 1.04 }} whileTap={shouldReduce ? undefined : { scale: 0.97 }}>
                <Link
                  href="/simulador"
                  className="group relative inline-block overflow-hidden rounded-2xl px-8 py-4 text-base font-bold"
                  style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight}, ${C.gold})`, color: C.bg }}
                >
                  <span className="relative z-10">Simular agora →</span>
                  <span className="pointer-events-none absolute inset-0 -translate-x-full -skew-x-12 bg-white/25 transition-transform duration-700 group-hover:translate-x-full" aria-hidden />
                </Link>
              </motion.div>
              <motion.div whileHover={shouldReduce ? undefined : { scale: 1.04 }} whileTap={shouldReduce ? undefined : { scale: 0.97 }}>
                <Link
                  href="/grupos"
                  className="inline-block rounded-2xl border-2 px-8 py-4 text-base font-bold transition-colors hover:bg-[#C9A84C]/10"
                  style={{ borderColor: C.gold, color: C.gold }}
                >
                  Ver grupos disponíveis
                </Link>
              </motion.div>
            </motion.div>
          </div>

          {/* Direita — mascote */}
          <div className="relative flex w-full flex-shrink-0 items-center justify-center lg:max-w-[420px]">

            {/* Balão de fala */}
            <AnimatePresence mode="wait">
              <motion.div
                key={fraseAtual}
                initial={shouldReduce ? false : { opacity: 0, scale: 0.85, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={shouldReduce ? undefined : { opacity: 0, scale: 0.85, y: -10 }}
                transition={{ duration: 0.4, ease: "backOut" }}
                className="absolute -top-4 right-4 z-20 max-w-[190px] px-4 py-3 text-center text-sm font-bold shadow-2xl lg:-top-8 lg:right-10"
                style={{
                  background: "white",
                  color: C.bg,
                  borderRadius: "1rem 1rem 1rem 0.25rem",
                  boxShadow: "0 8px 32px rgba(201,168,76,0.25)",
                }}
              >
                {FALAS[fraseAtual]}
                <span
                  className="absolute -bottom-3 left-5 block h-0 w-0"
                  style={{
                    borderLeft: "10px solid transparent",
                    borderRight: "10px solid transparent",
                    borderTop: "14px solid white",
                  }}
                  aria-hidden
                />
              </motion.div>
            </AnimatePresence>

            {/* Sombra dourada no chão */}
            <div
              className="pointer-events-none absolute bottom-4 left-1/2 h-12 w-48 -translate-x-1/2 rounded-full blur-2xl"
              style={{ background: "rgba(201,168,76,0.4)" }}
              aria-hidden
            />

            {/* Animação de float — CSS puro para não criar stacking context isolado */}
            <style>{`
              @keyframes mascote-float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-14px); }
              }
              .mascote-float { animation: mascote-float 3.5s ease-in-out infinite; }
            `}</style>

            {/* Wrapper com fundo igual ao da seção para o multiply funcionar */}
            <div
              className="mascote-float relative"
              style={{ isolation: "auto" }}
            >
              {!mascoteError ? (
                <img
                  src="/media/gauchinho-sem-fundo.svg"
                  alt="Mascote Gauchinho"
                  className="w-56 object-contain sm:w-64 lg:w-72 xl:w-80"
                  style={{
                    filter: "drop-shadow(0 0 60px rgba(201,168,76,0.4))",
                    display: "block",
                  }}
                  draggable={false}
                  onError={() => setMascoteError(true)}
                />
              ) : (
                <div
                  className="flex h-64 w-64 items-center justify-center rounded-full text-8xl"
                  style={{
                    background: "radial-gradient(circle, rgba(201,168,76,0.15), rgba(7,17,31,0.8))",
                    border: `2px solid ${C.goldBorder}`,
                  }}
                >
                  🤠
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SEÇÃO 3 — SIMULADOR RÁPIDO
      ══════════════════════════════════════════ */}
      <section
        className="px-4 py-24 sm:px-6 lg:px-16"
        style={{ background: `linear-gradient(180deg, ${C.bg} 0%, ${C.bgCard} 50%, ${C.bg} 100%)` }}
      >
        <div className="container mx-auto max-w-3xl">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible"
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: C.gold }}>Ferramenta gratuita</p>
            <h2 className="mb-4 text-4xl font-black text-white lg:text-5xl">
              Simule agora,{" "}
              <span style={{ color: C.gold }}>sem compromisso</span>
            </h2>
            <p className="text-lg" style={{ color: C.muted }}>Descubra o valor da sua parcela em segundos.</p>
          </motion.div>

          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible"
            viewport={{ once: true }}
            className="rounded-3xl border p-8"
            style={{ background: C.bgCard, borderColor: C.goldBorder }}
          >
            <div className="mb-8 flex gap-2 rounded-2xl p-1" style={{ background: C.bgMid }}>
              {(["consorcio", "financiamento"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTabSimulador(tab)}
                  className="flex-1 rounded-xl py-3 text-sm font-bold capitalize transition-all"
                  style={tabSimulador === tab ? { background: C.gold, color: C.bg } : { color: C.muted }}
                >
                  {tab === "consorcio" ? "Consórcio" : "Financiamento"}
                </button>
              ))}
            </div>

            <div className="mb-8">
              <div className="mb-3 flex justify-between">
                <label className="text-sm font-semibold" style={{ color: C.muted }}>Valor do crédito</label>
                <span className="text-lg font-black" style={{ color: C.gold }}>R$ {valorCredito.toLocaleString("pt-BR")}</span>
              </div>
              <input type="range" min={80000} max={2000000} step={10000}
                value={valorCredito} onChange={(e) => setValorCredito(Number(e.target.value))}
                className="w-full accent-[#C9A84C]" />
              <div className="mt-1 flex justify-between text-xs" style={{ color: C.muted }}>
                <span>R$ 80.000</span><span>R$ 2.000.000</span>
              </div>
            </div>

            <div className="mb-8">
              <div className="mb-3 flex justify-between">
                <label className="text-sm font-semibold" style={{ color: C.muted }}>Prazo</label>
                <span className="text-lg font-black" style={{ color: C.gold }}>{prazo} meses</span>
              </div>
              <input type="range" min={24} max={220} step={1}
                value={prazo} onChange={(e) => setPrazo(Number(e.target.value))}
                className="w-full accent-[#C9A84C]" />
              <div className="mt-1 flex justify-between text-xs" style={{ color: C.muted }}>
                <span>24 meses</span><span>220 meses</span>
              </div>
            </div>

            <div className="mb-6 rounded-2xl border p-6 text-center"
              style={{ background: C.bgMid, borderColor: C.goldBorder }}>
              <p className="mb-2 text-sm" style={{ color: C.muted }}>Parcela estimada</p>
              <p className="text-4xl font-black" style={{ color: C.gold }}>
                R$ {parcela}<span className="text-lg font-normal">/mês</span>
              </p>
              <p className="mt-2 text-xs" style={{ color: C.muted }}>Valor orientativo. Simulação completa na próxima página.</p>
            </div>

            <motion.div whileHover={shouldReduce ? undefined : { scale: 1.02 }} whileTap={shouldReduce ? undefined : { scale: 0.98 }}>
              <Link
                href="/simulador"
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-4 text-lg font-black"
                style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight}, ${C.gold})`, color: C.bg }}
              >
                <span className="relative z-10">Ver simulação completa →</span>
                <span className="pointer-events-none absolute inset-0 -translate-x-full -skew-x-12 bg-white/25 transition-transform duration-700 group-hover:translate-x-full" aria-hidden />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SEÇÃO 4 — BADGES
      ══════════════════════════════════════════ */}
      <section className="border-y px-4 py-16 sm:px-6 lg:px-16"
        style={{ background: C.bg, borderColor: C.border }}>
        <div className="container mx-auto grid grid-cols-2 gap-4 lg:grid-cols-4">
          {BADGES.map(({ icon: Icon, texto }, i) => (
            <motion.div key={texto}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center gap-3 rounded-2xl border p-5 text-center transition-transform duration-200 hover:scale-[1.03]"
              style={{ background: "rgba(201,168,76,0.05)", borderColor: C.goldBorder }}
            >
              <Icon size={28} style={{ color: C.gold }} aria-hidden />
              <span className="text-sm font-semibold text-white">{texto}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SEÇÃO 5 — DIFERENCIAIS
      ══════════════════════════════════════════ */}
      <section className="px-4 py-24 sm:px-6 lg:px-16" style={{ background: C.bgCard }}>
        <div className="container mx-auto">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible"
            viewport={{ once: true }} className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: C.gold }}>Por que o Gauchinho?</p>
            <h2 className="text-4xl font-black text-white lg:text-5xl">
              Consultoria que sustenta <span style={{ color: C.gold }}>cada número</span>
            </h2>
          </motion.div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {DIFERENCIAIS.map(({ icon: Icon, titulo, desc }, i) => (
              <motion.div key={titulo}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}
                className="rounded-3xl border p-8 transition-colors duration-300"
                style={{ background: C.bg, borderColor: C.border }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.gold; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
              >
                <Icon size={32} style={{ color: C.gold }} className="mb-4" aria-hidden />
                <h3 className="mb-3 text-xl font-black text-white">{titulo}</h3>
                <p className="leading-relaxed" style={{ color: C.muted }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SEÇÃO 6 — GRUPOS EM DESTAQUE
      ══════════════════════════════════════════ */}
      <section className="px-4 py-24 sm:px-6 lg:px-16" style={{ background: C.bg }}>
        <div className="container mx-auto">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible"
            viewport={{ once: true }} className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: C.gold }}>Disponíveis agora</p>
            <h2 className="text-4xl font-black text-white lg:text-5xl">
              Grupos em <span style={{ color: C.gold }}>destaque</span>
            </h2>
          </motion.div>

          <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {GRUPOS.map((g, i) => (
              <motion.div key={g.nome}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="rounded-2xl border p-6 transition-colors duration-300"
                style={{ background: C.bgCard, borderColor: C.border }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = C.gold;
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-6px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = C.border;
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                }}
              >
                <span className="mb-4 inline-block rounded-full px-3 py-1 text-xs font-black"
                  style={{ background: "rgba(201,168,76,0.12)", color: C.gold }}>{g.tipo}</span>
                <h3 className="mb-4 font-black text-white">{g.nome}</h3>
                <div className="space-y-2 text-sm" style={{ color: C.muted }}>
                  <div className="flex justify-between">
                    <span>Crédito</span>
                    <span className="text-base font-black text-white">{g.credito}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Parcela ref.</span>
                    <span className="font-bold" style={{ color: C.gold }}>{g.parcela}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Prazo</span>
                    <span className="text-white">{g.prazo}</span>
                  </div>
                </div>
                <Link href="/grupos"
                  className="mt-5 block rounded-xl border py-2 text-center text-sm font-bold transition-colors hover:bg-[#C9A84C]/10"
                  style={{ borderColor: C.goldBorder, color: C.gold }}>
                  Ver grupo →
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/grupos"
              className="inline-block rounded-2xl border-2 px-10 py-4 font-bold transition-colors hover:bg-[#C9A84C]/10"
              style={{ borderColor: C.gold, color: C.gold }}>
              Ver todos os grupos →
            </Link>
          </div>
        </div>
      </section>

      {/* Fase 9 — conteúdo publicado (oculto se vazio) */}
      <div style={{ background: C.bgCard }}>
        <FeaturedCasosSection casos={conteudoDestaques.casosDestaque} />
      </div>
      <div style={{ background: C.bg }}>
        <FeaturedDicasSection dicas={conteudoDestaques.dicasDestaque} />
      </div>
      <div style={{ background: C.bgCard }}>
        <FeaturedParceirosCmsSection parceiros={conteudoDestaques.parceirosDestaque} />
      </div>

      {/* ══════════════════════════════════════════
          SEÇÃO 7 — CTA FINAL
      ══════════════════════════════════════════ */}
      <section id="contato" className="relative overflow-hidden px-4 py-32 text-center sm:px-6" style={{ background: C.bg }}>
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(201,168,76,0.08), transparent)" }}
          aria-hidden />
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible"
          viewport={{ once: true }}
          className="relative z-10 mx-auto max-w-2xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: C.gold }}>Próximo passo</p>
          <h2 className="mb-6 text-5xl font-black text-white lg:text-6xl">
            Pronto para realizar<br />
            <span style={{ color: C.gold }}>seu sonho?</span>
          </h2>
          <p className="mb-12 text-xl" style={{ color: C.muted }}>
            Fale com um especialista e receba orientação personalizada para seu objetivo.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <motion.div whileHover={shouldReduce ? undefined : { scale: 1.04 }} whileTap={shouldReduce ? undefined : { scale: 0.97 }}>
              <Link href="/simulador"
                className="group relative inline-block overflow-hidden rounded-2xl px-10 py-5 text-xl font-black"
                style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight}, ${C.gold})`, color: C.bg }}>
                <span className="relative z-10">Simular agora →</span>
                <span className="pointer-events-none absolute inset-0 -translate-x-full -skew-x-12 bg-white/25 transition-transform duration-700 group-hover:translate-x-full" aria-hidden />
              </Link>
            </motion.div>
            <Link href="/simulador"
              className="inline-block rounded-2xl border-2 px-10 py-5 text-xl font-black transition-colors hover:bg-[#C9A84C]/10"
              style={{ borderColor: C.gold, color: C.gold }}>
              Falar com especialista
            </Link>
          </div>
        </motion.div>
      </section>

    </main>
  );
}
