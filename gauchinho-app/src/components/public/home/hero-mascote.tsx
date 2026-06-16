"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

const FALAS = [
  "Sem juros é consórcio! 🤝",
  "Realize o sonho da casa própria! 🏠",
  "Seu carro novo sem entrada! 🚗",
  "Contemplação por sorteio ou lance! ⭐",
  "Planejamento que cabe no seu bolso! 💰",
  "A gente te ajuda a conquistar! 🏆",
];

const PALAVRAS = ["Qual", "sonho", "você", "quer", "realizar?"];

type Props = { brand: string };

export function HeroMascote({ brand }: Props) {
  const shouldReduce = useReducedMotion();
  const [fraseAtual, setFraseAtual] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setFraseAtual((prev) => (prev + 1) % FALAS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      className="relative min-h-screen overflow-hidden"
      style={{ background: "var(--brand-blue)" }}
    >
      {/* Top amber radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(201,168,76,0.22) 0%, transparent 65%)",
        }}
        aria-hidden
      />
      {/* Right orb */}
      <div
        className="pointer-events-none absolute -right-32 top-32 h-[480px] w-[480px] rounded-full blur-[120px]"
        style={{ background: "rgba(201,168,76,0.10)" }}
        aria-hidden
      />
      {/* Left orb */}
      <div
        className="pointer-events-none absolute -left-32 bottom-0 h-80 w-80 rounded-full blur-[80px]"
        style={{ background: "rgba(201,168,76,0.07)" }}
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col items-center gap-10 px-4 pb-16 pt-24 sm:px-6 lg:flex-row lg:items-center lg:gap-16 lg:pt-0">
        {/* ── LEFT — copy ── */}
        <div className="flex-1 lg:max-w-[58%]">
          {/* Brand badge */}
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2"
            style={{
              background: "rgba(201,168,76,0.12)",
              border: "1px solid rgba(201,168,76,0.32)",
            }}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--brand-gold)" }} />
            <span
              className="text-[11px] font-bold uppercase tracking-[0.22em]"
              style={{ color: "var(--brand-gold)" }}
            >
              {brand}
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl xl:text-[4.8rem]">
            {mounted ? (
              <motion.span
                className="block"
                variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                initial="hidden"
                animate="visible"
              >
                {PALAVRAS.map((palavra, i) => (
                  <motion.span
                    key={i}
                    variants={{
                      hidden: { y: 60, opacity: 0 },
                      visible: {
                        y: 0,
                        opacity: 1,
                        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
                      },
                    }}
                    className="mr-[0.25em] inline-block"
                    style={i === 4 ? { color: "var(--brand-gold)" } : undefined}
                  >
                    {palavra}
                  </motion.span>
                ))}
              </motion.span>
            ) : (
              <>
                Qual sonho você quer{" "}
                <span style={{ color: "var(--brand-gold)" }}>realizar?</span>
              </>
            )}
          </h1>

          <p className="mt-7 max-w-2xl text-xl leading-relaxed text-slate-300">
            Consórcio, financiamento e oportunidades inteligentes para conquistar imóveis,
            veículos e grandes projetos com planejamento, segurança e estratégia.
          </p>

          {/* Stats */}
          <div className="mt-8 flex flex-wrap gap-6 border-t border-white/10 pt-8">
            {[
              { label: "Clientes atendidos", value: "+500" },
              { label: "Em crédito gerenciado", value: "R$ 80M+" },
              { label: "Anos de experiência", value: "10+" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs" style={{ color: "#94A3B8" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {/* Primary — gold shimmer */}
            <motion.a
              href="/simulador"
              whileHover={shouldReduce ? undefined : { scale: 1.03 }}
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              className="group relative inline-block overflow-hidden rounded-xl px-8 py-4 text-base font-bold"
              style={{
                background: "linear-gradient(135deg, #C9A84C, #F0D080, #C9A84C)",
                color: "#0A1628",
              }}
            >
              <span className="relative z-10">Simular agora</span>
              <motion.span
                className="pointer-events-none absolute inset-0 bg-white/30"
                style={{ skewX: "-12deg" }}
                initial={{ x: "-100%" }}
                whileHover={shouldReduce ? undefined : { x: "200%" }}
                transition={{ duration: 0.5 }}
                aria-hidden
              />
            </motion.a>

            {/* Secondary — gold outline */}
            <motion.a
              href="/grupos"
              whileHover={
                shouldReduce
                  ? undefined
                  : { scale: 1.03, backgroundColor: "rgba(201,168,76,0.1)" }
              }
              className="inline-block rounded-xl border-2 px-8 py-4 text-base font-bold transition-colors"
              style={{ borderColor: "var(--brand-gold)", color: "var(--brand-gold)" }}
            >
              Ver grupos disponíveis
            </motion.a>

            <motion.a
              href="/oportunidades-imobiliarias"
              whileHover={
                shouldReduce ? undefined : { scale: 1.03, backgroundColor: "rgba(255,255,255,0.05)" }
              }
              className="inline-block rounded-xl border border-white/20 px-8 py-4 text-base font-semibold text-white transition-colors"
            >
              Oportunidades imobiliárias
            </motion.a>
          </div>
        </div>

        {/* ── RIGHT — mascote + speech bubble ── */}
        <div className="relative flex w-full items-end justify-center lg:max-w-[38%]">
          {/* Speech bubble */}
          {mounted && (
            <div className="absolute -top-4 right-0 z-20 lg:-top-10 lg:right-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={fraseAtual}
                  initial={shouldReduce ? false : { opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={shouldReduce ? undefined : { opacity: 0, scale: 0.8, y: -10 }}
                  transition={{ duration: 0.4, ease: "backOut" }}
                  className="relative max-w-[190px] px-4 py-3 text-center text-sm font-bold shadow-2xl"
                  style={{
                    background: "white",
                    color: "#0A1628",
                    borderRadius: "1rem 1rem 1rem 0.25rem",
                    boxShadow: "0 8px 32px rgba(201,168,76,0.25)",
                  }}
                >
                  {FALAS[fraseAtual]}
                  {/* Triangle tail pointing down-left */}
                  <span
                    className="absolute -bottom-3 left-5"
                    style={{
                      display: "block",
                      width: 0,
                      height: 0,
                      borderLeft: "10px solid transparent",
                      borderRight: "10px solid transparent",
                      borderTop: "14px solid white",
                    }}
                    aria-hidden
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* Floating mascote video */}
          <motion.div
            animate={shouldReduce ? undefined : { y: [0, -14, 0] }}
            transition={
              shouldReduce
                ? undefined
                : { duration: 3, repeat: Infinity, ease: "easeInOut" }
            }
          >
            <video
              src="/media/gauchinho-video.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full max-w-[300px] sm:max-w-sm lg:max-w-md"
              style={{
                filter: "drop-shadow(0 0 60px rgba(201,168,76,0.4))",
              }}
            />
          </motion.div>
        </div>
      </div>

      <p className="sr-only">
        <Link href="/login">Área admin</Link>
      </p>
    </section>
  );
}
