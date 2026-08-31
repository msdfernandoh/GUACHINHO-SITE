import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator, CheckCircle2 } from "lucide-react";
import { CONSORCIO_SEO_SEGMENTS } from "@/lib/seo/consorcio-segments";

export const metadata: Metadata = {
  title: "Consórcio para Imóvel, Veículo, Caminhão e Máquinas",
  description: "Compare opções de consórcio para imóvel, carro, moto, caminhão, máquinas agrícolas e pesadas. Simule crédito, prazo, parcela e lance.",
  alternates: { canonical: "/consorcio" },
  keywords: ["consórcio", "simulador de consórcio", "carta de crédito", "consórcio sem entrada", "lance embutido"],
  openGraph: {
    title: "Consórcios por objetivo",
    description: "Encontre o planejamento de consórcio adequado ao seu objetivo e simule gratuitamente.",
    url: "/consorcio",
    type: "website",
  },
};

export default function ConsorcioPage() {
  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top,rgba(201,168,76,.15),transparent_45%)] px-4 py-20 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-xs font-bold uppercase tracking-[.28em] text-[#c9a84c]">Planejamento por objetivo</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">Consórcio para cada etapa do seu projeto</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">Compare modalidades, entenda taxas e contemplação e simule cenários antes de tomar sua decisão.</p>
          <Link href="/simulador?origem=seo-hub-consorcio" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#c9a84c] px-6 py-3 font-bold text-[#07111f] transition hover:bg-[#f0d080]">
            <Calculator className="h-5 w-5" /> Simular consórcio
          </Link>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2">
          {CONSORCIO_SEO_SEGMENTS.map((item) => (
            <article key={item.slug} className="group rounded-2xl border border-[#1e3a5f] bg-[#0d1e33] p-6 transition hover:-translate-y-1 hover:border-[#c9a84c]">
              <p className="text-xs font-bold uppercase tracking-widest text-[#c9a84c]">{item.eyebrow}</p>
              <h2 className="mt-3 text-2xl font-bold">{item.title}</h2>
              <p className="mt-3 leading-relaxed text-slate-400">{item.summary}</p>
              <div className="mt-5 flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-[#c9a84c]" /> Conteúdo, riscos e perguntas frequentes</div>
              <Link href={`/consorcio/${item.slug}`} className="mt-6 inline-flex items-center gap-2 font-semibold text-[#c9a84c]">Entender esta modalidade <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
