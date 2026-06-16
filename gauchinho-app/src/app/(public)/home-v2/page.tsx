"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Brain,
  Target,
  BarChart2,
  FileText,
  Home,
  Car,
  Bike,
  Truck,
  Tractor,
  Handshake,
  Shield,
  Trophy,
  Wallet,
  BadgeCheck,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";

// ─── DADOS ────────────────────────────────────────────────

const FALAS = [
  "Sem juros é consórcio! 🤝",
  "Realize o sonho da casa própria! 🏠",
  "Seu carro novo sem entrada! 🚗",
  "Contemplação por sorteio ou lance! ⭐",
  "Planejamento que cabe no bolso! 💰",
  "A gente te ajuda a conquistar! 🏆",
];

const SONHOS = [
  {
    label: "Imóveis",
    desc: "Casa, apartamento ou terreno com planejamento e consórcio orientado.",
    href: "/simulador?solucao=consorcio&tipo=imovel",
    img: "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=80",
    icon: Home,
  },
  {
    label: "Veículos",
    desc: "Carro novo ou seminovo com parcelas alinhadas ao seu orçamento.",
    href: "/simulador?solucao=consorcio&tipo=automovel",
    img: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80",
    icon: Car,
  },
  {
    label: "Motos",
    desc: "Mobilidade com crédito planejado e consultoria de lance.",
    href: "/simulador?tipo=moto&solucao=consorcio",
    img: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&q=80",
    icon: Bike,
  },
  {
    label: "Caminhonetes",
    desc: "Utilitários para trabalho e lazer com estratégia comercial.",
    href: "/simulador?tipo=caminhonete&solucao=consorcio",
    img: "https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800&q=80",
    icon: Truck,
  },
  {
    label: "Caminhões",
    desc: "Frota e transporte com análise patrimonial e comparativo.",
    href: "/simulador?tipo=caminhao&solucao=consorcio",
    img: "https://images.unsplash.com/photo-1586191582056-b7d8c6a1c433?w=800&q=80",
    icon: Truck,
  },
  {
    label: "Máquinas Agrícolas",
    desc: "Produtividade e performance para o campo e para a obra.",
    href: "/simulador?tipo=maquinario&solucao=consorcio",
    img: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=800&q=80",
    icon: Tractor,
  },
];

const DIFERENCIAIS = [
  {
    icon: Brain,
    titulo: "Atendimento consultivo",
    desc: "Especialistas que traduzem números em decisões claras para o seu momento.",
  },
  {
    icon: Target,
    titulo: "Estratégias de lance",
    desc: "Cenários de lance embutido e livre para enxergar risco e oportunidade.",
  },
  {
    icon: BarChart2,
    titulo: "Consórcio × Financiamento",
    desc: "Comparativo financeiro lado a lado, sem jargão e sem promessa vazia.",
  },
  {
    icon: FileText,
    titulo: "Propostas em PDF",
    desc: "Material profissional para compartilhar com família, sócios ou contador.",
  },
];

const BADGES = [
  { icon: BadgeCheck, texto: "Sem juros é consórcio!" },
  { icon: Wallet, texto: "Parcelas que cabem no bolso" },
  { icon: Trophy, texto: "Contemplação por lance ou sorteio" },
  { icon: Shield, texto: "Segurança e transparência" },
];

const GRUPOS = [
  { nome: "Grupo 1473", tipo: "Imóvel",  credito: "R$ 450.000",    parcela: "R$ 1.546,36", prazo: "220 meses" },
  { nome: "Grupo 1503", tipo: "Imóvel",  credito: "R$ 1.102.500",  parcela: "R$ 3.698,39", prazo: "220 meses" },
  { nome: "Grupo 1513", tipo: "Imóvel",  credito: "R$ 1.050.000",  parcela: "R$ 2.863,64", prazo: "220 meses" },
  { nome: "Grupo 1533", tipo: "Imóvel",  credito: "R$ 1.500.000",  parcela: "R$ 5.339,71", prazo: "220 meses" },
];

// ─── PALETA ───────────────────────────────────────────────
const C = {
  bg:         "#07111F",
  bgCard:     "#0D1E33",
  bgMid:      "#112240",
  gold:       "#C9A84C",
  goldLight:  "#F0D080",
  text:       "#FFFFFF",
  muted:      "#94A3B8",
  border:     "#1E3A5F",
  goldBorder: "rgba(201,168,76,0.3)",
} as const;

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────

export default function HomeV2() {
  const shouldReduce = useReducedMotion();
  const [fraseAtual, setFraseAtual] = useState(0);
  const [tabSimulador, setTabSimulador] = useState<"consorcio" | "financiamento">("consorcio");
  const [valorCredito, setValorCredito] = useState(300000);
  const [prazo, setPrazo] = useState(100);

  useEffect(() => {
    const t = setInterval(() => setFraseAtual((p) => (p + 1) % FALAS.length), 3000);
    return () => clearInterval(t);
  }, []);

  const taxaAdmin = tabSimulador === "consorcio" ? 0.18 : 0.02;
  const parcelaNum = ((valorCredito * (1 + taxaAdmin)) / prazo).toFixed(2);
  const parcela = parcelaNum.replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const fadeUp = {
    hidden: shouldReduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: shouldReduce ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  return (
    <main style={{ background: C.bg, color: C.text, fontFamily: "inherit" }}>

      {/* ══════════════════════════════════════════
          SEÇÃO 1 — HERO
      ══════════════════════════════════════════ */}
      <section
        className="relative flex min-h-screen items-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${C.bg} 0%, ${C.bgCard} 60%, ${C.bg} 100%)`,
        }}
      >
        {/* Glow dourado */}
        <div
          className="pointer-events-none absolute right-1/4 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full opacity-10 blur-3xl"
          style={{ background: `radial-gradient(circle, ${C.gold}, transparent)` }}
          aria-hidden
        />

        <div className="container relative z-10 mx-auto flex flex-col items-center gap-12 px-6 py-24 lg:flex-row lg:px-16">

          {/* Esquerda — copy */}
          <div className="flex-1 text-center lg:text-left">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: C.goldBorder, color: C.gold, background: "rgba(201,168,76,0.08)" }}
            >
              ★ Escritório de Soluções Financeiras
            </motion.div>

            {/* Título palavra por palavra */}
            <motion.h1
              className="mb-6 text-5xl font-black leading-tight lg:text-7xl"
              variants={{ visible: { transition: { staggerChildren: 0.09 } } }}
              initial="hidden"
              animate="visible"
            >
              {["Qual", "sonho", "você", "quer", "realizar?"].map((word, i) => (
                <motion.span
                  key={i}
                  variants={{
                    hidden: { y: 80, opacity: 0 },
                    visible: {
                      y: 0,
                      opacity: 1,
                      transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
                    },
                  }}
                  className="mr-4 inline-block"
                  style={["sonho", "realizar?"].includes(word) ? { color: C.gold } : undefined}
                >
                  {word}
                </motion.span>
              ))}
            </motion.h1>

            {/* Subtítulo */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="mx-auto mb-10 max-w-lg text-xl leading-relaxed lg:mx-0"
              style={{ color: C.muted }}
            >
              Consórcio, financiamento e oportunidades inteligentes para conquistar
              imóveis, veículos e grandes projetos com planejamento e estratégia.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="mb-12 flex flex-wrap justify-center gap-4 lg:justify-start"
            >
              <motion.div whileHover={shouldReduce ? undefined : { scale: 1.04 }} whileTap={shouldReduce ? undefined : { scale: 0.97 }}>
                <Link
                  href="/simulador"
                  className="relative inline-block overflow-hidden rounded-2xl px-8 py-4 text-lg font-bold"
                  style={{
                    background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight}, ${C.gold})`,
                    color: C.bg,
                  }}
                >
                  <span className="relative z-10">Simular agora →</span>
                  <motion.div
                    className="absolute inset-0 bg-white/25"
                    style={{ skewX: "-12deg" }}
                    initial={{ x: "-100%" }}
                    whileHover={shouldReduce ? undefined : { x: "200%" }}
                    transition={{ duration: 0.5 }}
                    aria-hidden
                  />
                </Link>
              </motion.div>

              <motion.div whileHover={shouldReduce ? undefined : { scale: 1.04 }} whileTap={shouldReduce ? undefined : { scale: 0.97 }}>
                <Link
                  href="/grupos"
                  className="inline-block rounded-2xl border-2 px-8 py-4 text-lg font-bold transition-colors"
                  style={{ borderColor: C.gold, color: C.gold }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(201,168,76,0.10)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  Ver grupos disponíveis
                </Link>
              </motion.div>
            </motion.div>

            {/* Micro badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
              className="flex flex-wrap justify-center gap-6 text-sm lg:justify-start"
              style={{ color: C.muted }}
            >
              {["✓ Sem juros", "✓ Contemplação por lance", "✓ Parcelas que cabem no bolso"].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </motion.div>
          </div>

          {/* Direita — mascote + balão de fala */}
          <div className="relative flex w-full flex-shrink-0 items-end justify-center lg:w-80 xl:w-96">

            {/* Balão de fala */}
            <AnimatePresence mode="wait">
              <motion.div
                key={fraseAtual}
                initial={shouldReduce ? false : { opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={shouldReduce ? undefined : { opacity: 0, scale: 0.8, y: -10 }}
                transition={{ duration: 0.4, ease: "backOut" }}
                className="absolute -top-12 left-0 z-20 max-w-[200px] px-5 py-4 text-center text-sm font-bold shadow-2xl"
                style={{
                  background: "white",
                  color: C.bg,
                  borderRadius: "1rem 1rem 1rem 0.25rem",
                  boxShadow: "0 8px 32px rgba(201,168,76,0.25)",
                }}
              >
                {FALAS[fraseAtual]}
                {/* Triângulo */}
                <span
                  className="absolute -bottom-3 left-6 block h-0 w-0"
                  style={{
                    borderLeft: "10px solid transparent",
                    borderRight: "10px solid transparent",
                    borderTop: "14px solid white",
                  }}
                  aria-hidden
                />
              </motion.div>
            </AnimatePresence>

            {/* Mascote flutuando */}
            <motion.div
              animate={shouldReduce ? undefined : { y: [0, -16, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ filter: "drop-shadow(0 0 60px rgba(201,168,76,0.35))" }}
            >
              <video
                src="/media/gauchinho-video.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-72 object-contain lg:w-80 xl:w-96"
              />
            </motion.div>
          </div>
        </div>

        {/* Seta de scroll */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={shouldReduce ? undefined : { y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          aria-hidden
        >
          <ChevronDown size={28} style={{ color: C.gold, opacity: 0.6 }} />
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════
          SEÇÃO 2 — SONHOS (cards com imagem)
      ══════════════════════════════════════════ */}
      <section className="px-6 py-24 lg:px-16" style={{ background: C.bg }}>
        <div className="container mx-auto">

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <p className="mb-3 text-sm font-bold uppercase tracking-widest" style={{ color: C.gold }}>
              Escolha seu objetivo
            </p>
            <h2 className="mb-4 text-4xl font-black text-white lg:text-5xl">
              Qual é o seu <span style={{ color: C.gold }}>sonho</span>?
            </h2>
            <p className="mx-auto max-w-xl text-lg" style={{ color: C.muted }}>
              Cada objetivo leva ao simulador e grupos ideais para o seu momento.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {SONHOS.map((sonho, i) => (
              <motion.div
                key={sonho.label}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                whileHover="hover"
              >
                <Link
                  href={sonho.href}
                  className="relative block cursor-pointer overflow-hidden rounded-3xl"
                  style={{ height: "400px" }}
                >
                  {/* Imagem com zoom no hover */}
                  <motion.div
                    variants={shouldReduce ? undefined : { hover: { scale: 1.08 } }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${sonho.img})` }}
                  />
                  {/* Overlay */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(to top, ${C.bg} 0%, rgba(7,17,31,0.5) 50%, transparent 100%)`,
                    }}
                  />
                  {/* Borda dourada no hover */}
                  <motion.div
                    className="absolute inset-0 rounded-3xl border-2 opacity-0"
                    variants={{ hover: { opacity: 1 } }}
                    style={{ borderColor: C.gold }}
                  />
                  {/* Conteúdo */}
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="mb-2 flex items-center gap-2">
                      <sonho.icon size={20} style={{ color: C.gold }} aria-hidden />
                      <h3 className="text-2xl font-black text-white">{sonho.label}</h3>
                    </div>
                    <p className="mb-4 text-sm leading-relaxed" style={{ color: C.muted }}>
                      {sonho.desc}
                    </p>
                    <motion.span
                      variants={shouldReduce ? undefined : { hover: { x: 6 } }}
                      transition={{ duration: 0.2 }}
                      className="inline-flex items-center gap-2 text-sm font-bold"
                      style={{ color: C.gold }}
                    >
                      Explorar →
                    </motion.span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SEÇÃO 3 — SIMULADOR RÁPIDO
      ══════════════════════════════════════════ */}
      <section
        className="px-6 py-24 lg:px-16"
        style={{
          background: `linear-gradient(180deg, ${C.bg} 0%, ${C.bgCard} 50%, ${C.bg} 100%)`,
        }}
      >
        <div className="container mx-auto max-w-3xl">

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <p className="mb-3 text-sm font-bold uppercase tracking-widest" style={{ color: C.gold }}>
              Ferramenta gratuita
            </p>
            <h2 className="mb-4 text-4xl font-black text-white lg:text-5xl">
              Simule agora,{" "}
              <span style={{ color: C.gold }}>sem compromisso</span>
            </h2>
            <p className="text-lg" style={{ color: C.muted }}>
              Descubra o valor da sua parcela em segundos.
            </p>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="rounded-3xl border p-8"
            style={{ background: C.bgCard, borderColor: C.goldBorder }}
          >
            {/* Tabs consórcio / financiamento */}
            <div
              className="mb-8 flex gap-2 rounded-2xl p-1"
              style={{ background: C.bgMid }}
            >
              {(["consorcio", "financiamento"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTabSimulador(tab)}
                  className="flex-1 rounded-xl py-3 text-sm font-bold capitalize transition-all"
                  style={
                    tabSimulador === tab
                      ? { background: C.gold, color: C.bg }
                      : { color: C.muted }
                  }
                >
                  {tab === "consorcio" ? "Consórcio" : "Financiamento"}
                </button>
              ))}
            </div>

            {/* Slider — valor do crédito */}
            <div className="mb-8">
              <div className="mb-3 flex justify-between">
                <label className="text-sm font-semibold" style={{ color: C.muted }}>
                  Valor do crédito
                </label>
                <span className="text-lg font-black" style={{ color: C.gold }}>
                  R$ {valorCredito.toLocaleString("pt-BR")}
                </span>
              </div>
              <input
                type="range"
                min={80000}
                max={2000000}
                step={10000}
                value={valorCredito}
                onChange={(e) => setValorCredito(Number(e.target.value))}
                className="w-full accent-[#C9A84C]"
              />
              <div className="mt-1 flex justify-between text-xs" style={{ color: C.muted }}>
                <span>R$ 80.000</span>
                <span>R$ 2.000.000</span>
              </div>
            </div>

            {/* Slider — prazo */}
            <div className="mb-8">
              <div className="mb-3 flex justify-between">
                <label className="text-sm font-semibold" style={{ color: C.muted }}>
                  Prazo
                </label>
                <span className="text-lg font-black" style={{ color: C.gold }}>
                  {prazo} meses
                </span>
              </div>
              <input
                type="range"
                min={24}
                max={220}
                step={1}
                value={prazo}
                onChange={(e) => setPrazo(Number(e.target.value))}
                className="w-full accent-[#C9A84C]"
              />
              <div className="mt-1 flex justify-between text-xs" style={{ color: C.muted }}>
                <span>24 meses</span>
                <span>220 meses</span>
              </div>
            </div>

            {/* Resultado estimado */}
            <div
              className="mb-6 rounded-2xl border p-6 text-center"
              style={{ background: C.bgMid, borderColor: C.goldBorder }}
            >
              <p className="mb-2 text-sm" style={{ color: C.muted }}>
                Parcela estimada
              </p>
              <p className="text-4xl font-black" style={{ color: C.gold }}>
                R$ {parcela}
                <span className="text-lg font-normal">/mês</span>
              </p>
              <p className="mt-2 text-xs" style={{ color: C.muted }}>
                Valor orientativo. Simulação completa na próxima página.
              </p>
            </div>

            {/* CTA */}
            <motion.div
              whileHover={shouldReduce ? undefined : { scale: 1.02 }}
              whileTap={shouldReduce ? undefined : { scale: 0.98 }}
            >
              <Link
                href="/simulador"
                className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-4 text-lg font-black"
                style={{
                  background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight}, ${C.gold})`,
                  color: C.bg,
                }}
              >
                <span className="relative z-10">Ver simulação completa →</span>
                <motion.div
                  className="absolute inset-0 bg-white/25"
                  style={{ skewX: "-12deg" }}
                  initial={{ x: "-100%" }}
                  whileHover={shouldReduce ? undefined : { x: "200%" }}
                  transition={{ duration: 0.5 }}
                  aria-hidden
                />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SEÇÃO 4 — BADGES DE CONFIANÇA
      ══════════════════════════════════════════ */}
      <section
        className="border-y px-6 py-16 lg:px-16"
        style={{ background: C.bg, borderColor: C.border }}
      >
        <div className="container mx-auto grid grid-cols-2 gap-6 lg:grid-cols-4">
          {BADGES.map(({ icon: Icon, texto }, i) => (
            <motion.div
              key={texto}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center gap-3 rounded-2xl border p-5 text-center"
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
      <section className="px-6 py-24 lg:px-16" style={{ background: C.bgCard }}>
        <div className="container mx-auto">

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <p className="mb-3 text-sm font-bold uppercase tracking-widest" style={{ color: C.gold }}>
              Por que o Gauchinho?
            </p>
            <h2 className="text-4xl font-black text-white lg:text-5xl">
              Consultoria que sustenta{" "}
              <span style={{ color: C.gold }}>cada número</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {DIFERENCIAIS.map(({ icon: Icon, titulo, desc }, i) => (
              <motion.div
                key={titulo}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={shouldReduce ? undefined : { borderColor: C.gold }}
                className="rounded-3xl border p-8 transition-colors duration-300"
                style={{ background: C.bg, borderColor: C.border }}
              >
                <Icon size={32} style={{ color: C.gold }} className="mb-4" aria-hidden />
                <h3 className="mb-3 text-xl font-black text-white">{titulo}</h3>
                <p className="leading-relaxed" style={{ color: C.muted }}>
                  {desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SEÇÃO 6 — GRUPOS EM DESTAQUE
      ══════════════════════════════════════════ */}
      <section className="px-6 py-24 lg:px-16" style={{ background: C.bg }}>
        <div className="container mx-auto">

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <p className="mb-3 text-sm font-bold uppercase tracking-widest" style={{ color: C.gold }}>
              Disponíveis agora
            </p>
            <h2 className="text-4xl font-black text-white lg:text-5xl">
              Grupos em <span style={{ color: C.gold }}>destaque</span>
            </h2>
          </motion.div>

          <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {GRUPOS.map((g, i) => (
              <motion.div
                key={g.nome}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={shouldReduce ? undefined : { y: -6, transition: { duration: 0.2 } }}
                className="rounded-2xl border p-6 transition-colors duration-300"
                style={{ background: C.bgCard, borderColor: C.border }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.gold; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
              >
                <span
                  className="mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold"
                  style={{ background: "rgba(201,168,76,0.12)", color: C.gold }}
                >
                  {g.tipo}
                </span>
                <h3 className="mb-4 font-black text-white">{g.nome}</h3>
                <div className="space-y-2 text-sm" style={{ color: C.muted }}>
                  <div className="flex justify-between">
                    <span>Crédito</span>
                    <span className="text-base font-black text-white">{g.credito}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Parcela ref.</span>
                    <span className="font-bold" style={{ color: C.gold }}>
                      {g.parcela}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Prazo</span>
                    <span className="text-white">{g.prazo}</span>
                  </div>
                </div>
                <Link
                  href="/grupos"
                  className="mt-5 block rounded-xl border py-2 text-center text-sm font-bold transition-colors"
                  style={{ borderColor: C.goldBorder, color: C.gold }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(201,168,76,0.10)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  Ver grupo →
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <motion.div whileHover={shouldReduce ? undefined : { scale: 1.04 }} whileTap={shouldReduce ? undefined : { scale: 0.97 }}>
              <Link
                href="/grupos"
                className="inline-block rounded-2xl border-2 px-10 py-4 font-bold transition-colors"
                style={{ borderColor: C.gold, color: C.gold }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(201,168,76,0.10)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                Ver todos os grupos →
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SEÇÃO 7 — CTA FINAL
      ══════════════════════════════════════════ */}
      <section
        id="contato"
        className="relative overflow-hidden px-6 py-32 text-center"
        style={{ background: C.bg }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(201,168,76,0.08), transparent)",
          }}
          aria-hidden
        />

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative z-10 mx-auto max-w-2xl"
        >
          <p className="mb-4 text-sm font-bold uppercase tracking-widest" style={{ color: C.gold }}>
            Próximo passo
          </p>
          <h2 className="mb-6 text-5xl font-black text-white lg:text-6xl">
            Pronto para realizar
            <br />
            <span style={{ color: C.gold }}>seu sonho?</span>
          </h2>
          <p className="mb-12 text-xl" style={{ color: C.muted }}>
            Fale com um especialista e receba orientação personalizada para seu objetivo.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <motion.div whileHover={shouldReduce ? undefined : { scale: 1.04 }} whileTap={shouldReduce ? undefined : { scale: 0.97 }}>
              <Link
                href="/simulador"
                className="relative inline-block overflow-hidden rounded-2xl px-10 py-5 text-xl font-black"
                style={{
                  background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight}, ${C.gold})`,
                  color: C.bg,
                }}
              >
                <span className="relative z-10">Simular agora →</span>
                <motion.div
                  className="absolute inset-0 bg-white/25"
                  style={{ skewX: "-12deg" }}
                  initial={{ x: "-100%" }}
                  whileHover={shouldReduce ? undefined : { x: "200%" }}
                  transition={{ duration: 0.5 }}
                  aria-hidden
                />
              </Link>
            </motion.div>

            <motion.div whileHover={shouldReduce ? undefined : { scale: 1.04 }} whileTap={shouldReduce ? undefined : { scale: 0.97 }}>
              <Link
                href="#contato"
                className="inline-block rounded-2xl border-2 px-10 py-5 text-xl font-black transition-colors"
                style={{ borderColor: C.gold, color: C.gold }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(201,168,76,0.10)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                Falar com especialista
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>

    </main>
  );
}
