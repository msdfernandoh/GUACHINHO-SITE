import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DREAM_CARDS } from "@/lib/home/home-content";
import { HomeSection } from "./home-section";

export function HomeDreamCards() {
  return (
    <HomeSection
      eyebrow="Sonhos"
      title="Qual sonho você quer realizar?"
      subtitle="Escolha o caminho — levamos você ao simulador, grupos ou vitrine certa."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DREAM_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.id}
              href={card.href}
              className={`group relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br ${card.accent} p-6 transition duration-300 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-500/5`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-950/60 text-amber-400 ring-1 ring-zinc-700/80">
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <ArrowUpRight className="h-5 w-5 text-zinc-600 transition group-hover:text-amber-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{card.description}</p>
            </Link>
          );
        })}
      </div>
    </HomeSection>
  );
}
