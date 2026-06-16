"use client";

import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { HOME_MEDIA } from "@/lib/home/home-media";
import { HomeCtaLink, HomeSection } from "./home-section";
import { HomeReveal } from "./home-reveal";

function specialistHref() {
  return "#contato";
}

export function HomeVideoSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  return (
    <HomeSection
      eyebrow="Gauchinho em movimento"
      title="Conheça uma nova forma de planejar sua conquista"
      subtitle="O Gauchinho Escritório de Soluções Financeiras conecta consórcio, financiamento, cartas contempladas e oportunidades imobiliárias em uma experiência consultiva, clara e estratégica."
      className="bg-gradient-to-b from-zinc-950 via-zinc-900/40 to-zinc-950"
    >
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
        <HomeReveal>
          <p className="text-sm leading-relaxed text-zinc-400 md:text-base">
            Assista à mensagem da campanha e entenda como unimos tecnologia, consultoria e parceiros
            para transformar objetivos em planos executáveis — com transparência em cada etapa.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-zinc-300">
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              Consórcio e financiamento com comparativo real
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              Cartas contempladas e oportunidades imobiliárias integradas
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              Atendimento consultivo, não robô de formulário
            </li>
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <HomeCtaLink href={specialistHref()}>Falar com especialista</HomeCtaLink>
            <HomeCtaLink href="/simulador" variant="outline">
              Simular meu objetivo
            </HomeCtaLink>
          </div>
        </HomeReveal>

        <HomeReveal delayMs={120}>
          <div className="home-gold-glow relative rounded-[1.75rem] border border-amber-500/25 bg-zinc-950/80 p-2 shadow-2xl shadow-black/50">
            <div className="relative overflow-hidden rounded-[1.4rem] bg-zinc-900">
              <video
                ref={videoRef}
                className="aspect-video w-full object-cover"
                playsInline
                muted
                loop
                autoPlay
                preload="metadata"
                poster={HOME_MEDIA.poster}
              >
                <source src={HOME_MEDIA.video} type="video/mp4" />
              </video>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-zinc-950/20" />
              <button
                type="button"
                onClick={togglePlay}
                className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full border border-zinc-600/80 bg-zinc-950/80 px-4 py-2 text-xs font-semibold text-zinc-100 backdrop-blur-md transition hover:border-amber-500/50 hover:text-amber-300"
                aria-label={playing ? "Pausar vídeo" : "Reproduzir vídeo"}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {playing ? "Pausar" : "Play"}
              </button>
            </div>
            <p className="px-3 py-3 text-center text-xs text-zinc-500">
              Campanha institucional Gauchinho · vídeo com áudio desligado para melhor experiência na
              web
            </p>
          </div>
        </HomeReveal>
      </div>
    </HomeSection>
  );
}
