import { Shield, LineChart, FileText, Users, Scale, Sparkles } from "lucide-react";
import { AUTHORITY_ITEMS } from "@/lib/home/home-content";
import { HomeReveal } from "./home-reveal";
import { HomeSection } from "./home-section";

const ICONS = [Users, LineChart, Scale, Shield, FileText, Sparkles] as const;

export function AuthoritySection() {
  return (
    <HomeSection
      eyebrow="Prova de autoridade"
      title="Consultoria que sustenta cada número"
      subtitle="Compromissos reais de processo — sem prometer resultado garantido, com método claro."
      className="border-y border-zinc-800/50 bg-zinc-900/25"
    >
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {AUTHORITY_ITEMS.map((item, i) => {
          const Icon = ICONS[i] ?? Sparkles;
          return (
            <HomeReveal key={item.title} delayMs={i * 50}>
              <article className="group h-full rounded-2xl border border-zinc-800/90 bg-zinc-950/60 p-6 transition duration-300 hover:border-amber-500/35 hover:bg-zinc-900/80">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400 transition group-hover:scale-105">
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.text}</p>
              </article>
            </HomeReveal>
          );
        })}
      </div>
    </HomeSection>
  );
}
