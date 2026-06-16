import Link from "next/link";
import { SOLUTION_CARDS } from "@/lib/home/home-content";
import { HomeSection } from "./home-section";

export function HomeSolutions() {
  return (
    <HomeSection
      eyebrow="Portfólio"
      title="Nossas soluções"
      subtitle="Cada produto com caminho claro e call-to-action."
      className="border-y border-zinc-800/60 bg-zinc-900/20"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SOLUTION_CARDS.map((s) => (
          <article
            key={s.title}
            className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 transition hover:border-amber-500/35"
          >
            <h3 className="text-lg font-semibold text-white">{s.title}</h3>
            <p className="mt-2 flex-1 text-sm text-zinc-400">{s.text}</p>
            <Link
              href={s.href}
              className="mt-5 inline-flex text-sm font-semibold text-amber-400 hover:text-amber-300"
            >
              {s.cta} →
            </Link>
          </article>
        ))}
      </div>
    </HomeSection>
  );
}
