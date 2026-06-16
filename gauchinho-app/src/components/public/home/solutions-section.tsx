import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SOLUTION_CARDS } from "@/lib/home/home-content";
import { HomeReveal } from "./home-reveal";
import { HomeSection } from "./home-section";

export function SolutionsSection() {
  return (
    <HomeSection
      eyebrow="Portfólio"
      title="Soluções principais"
      subtitle="Cada produto com narrativa clara, gradiente premium e caminho direto para ação."
    >
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {SOLUTION_CARDS.map((s, i) => (
          <HomeReveal key={s.title} delayMs={i * 55}>
            <article
              className={`group relative flex min-h-[240px] flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br ${s.gradient} p-6 transition duration-500 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-2xl hover:shadow-amber-500/10`}
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/5 blur-2xl" />
              <h3 className="text-xl font-bold text-white">{s.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-400">{s.text}</p>
              <Link
                href={s.href}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-amber-400 transition group-hover:gap-3 group-hover:text-amber-300"
              >
                {s.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          </HomeReveal>
        ))}
      </div>
    </HomeSection>
  );
}
