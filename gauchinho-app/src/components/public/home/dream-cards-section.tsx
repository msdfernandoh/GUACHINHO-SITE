import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DREAM_CARDS } from "@/lib/home/home-content";
import { HomeReveal } from "./home-reveal";
import { HomeSection } from "./home-section";

export function DreamCardsSection() {
  return (
    <HomeSection
      id="objetivos"
      eyebrow="Escolha seu objetivo"
      title="O caminho certo começa com clareza"
      subtitle="Cards pensados para conversão: cada objetivo leva ao simulador, grupos ou vitrine ideal."
      className="relative"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"
        aria-hidden
      />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {DREAM_CARDS.map((card, index) => {
          const Icon = card.icon;
          return (
            <HomeReveal key={card.id} delayMs={index * 60}>
              <Link
                href={card.href}
                className={`group relative flex min-h-[220px] flex-col overflow-hidden rounded-3xl border border-zinc-800/90 bg-gradient-to-br ${card.accent} p-6 shadow-xl shadow-black/30 transition duration-500 hover:-translate-y-1.5 hover:border-amber-500/45 hover:shadow-2xl ${card.ring}`}
              >
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl transition group-hover:bg-amber-500/20"
                  aria-hidden
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-zinc-950/70 text-amber-400 shadow-inner">
                    <Icon className="h-7 w-7" aria-hidden />
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-zinc-600 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-amber-400" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-white">{card.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">{card.description}</p>
                <span className="mt-5 text-xs font-semibold uppercase tracking-wider text-amber-500/90 transition group-hover:text-amber-400">
                  Explorar →
                </span>
              </Link>
            </HomeReveal>
          );
        })}
      </div>
    </HomeSection>
  );
}
