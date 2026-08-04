import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Calculator, CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { CONSORCIO_SEO_SEGMENTS, getConsorcioSeoSegment } from "@/lib/seo/consorcio-segments";

type Props = { params: Promise<{ segmento: string }> };

export function generateStaticParams() {
  return CONSORCIO_SEO_SEGMENTS.map(({ slug }) => ({ segmento: slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segmento } = await params;
  const page = getConsorcioSeoSegment(segmento);
  if (!page) return {};
  const path = `/consorcio/${page.slug}`;
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    keywords: page.keywords,
    alternates: { canonical: path },
    openGraph: { title: page.metaTitle, description: page.metaDescription, url: path, type: "article", locale: "pt_BR" },
    twitter: { card: "summary_large_image", title: page.metaTitle, description: page.metaDescription },
  };
}

export default async function ConsorcioSegmentPage({ params }: Props) {
  const { segmento } = await params;
  const page = getConsorcioSeoSegment(segmento);
  if (!page) notFound();
  const origin = getPublicSiteUrl() ?? "https://www.gauchinhoconsorcios.com.br";
  const url = `${origin}/consorcio/${page.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: page.title,
        description: page.metaDescription,
        url,
        provider: { "@id": `${origin}/#organization` },
        areaServed: { "@type": "Country", name: "Brasil" },
        serviceType: "Consultoria e simulação de consórcio",
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: page.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: origin },
          { "@type": "ListItem", position: 2, name: "Consórcio", item: `${origin}/consorcio` },
          { "@type": "ListItem", position: 3, name: page.title, item: url },
        ],
      },
    ],
  };

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_70%_20%,rgba(201,168,76,.17),transparent_42%)] px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <nav aria-label="Breadcrumb" className="mb-8 text-sm text-slate-400"><Link href="/" className="hover:text-white">Início</Link> <span aria-hidden> / </span> <Link href="/consorcio" className="hover:text-white">Consórcio</Link> <span aria-hidden> / </span> <span>{page.title}</span></nav>
          <p className="text-xs font-bold uppercase tracking-[.28em] text-[#c9a84c]">{page.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">{page.title}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-300">{page.summary}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={page.simulatorHref} className="inline-flex items-center gap-2 rounded-xl bg-[#c9a84c] px-6 py-3 font-bold text-[#07111f] transition hover:bg-[#f0d080]"><Calculator className="h-5 w-5" /> Simular agora</Link>
            <Link href="/grupos" className="inline-flex items-center gap-2 rounded-xl border border-[#c9a84c] px-6 py-3 font-bold text-[#c9a84c] hover:bg-[#c9a84c]/10">Ver grupos disponíveis</Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <h2 className="text-3xl font-black">Para quem esta modalidade faz sentido?</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-300">{page.audience}</p>
            <h2 className="mt-12 text-3xl font-black">Pontos que ajudam no planejamento</h2>
            <ul className="mt-6 space-y-4">
              {page.benefits.map((item) => <li key={item} className="flex gap-3 text-slate-300"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#c9a84c]" />{item}</li>)}
            </ul>
          </div>
          <aside className="rounded-2xl border border-[#c9a84c]/30 bg-[#0d1e33] p-6 lg:p-8">
            <div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-[#c9a84c]" /><h2 className="text-2xl font-bold">Antes de contratar</h2></div>
            <ul className="mt-6 space-y-4">
              {page.considerations.map((item) => <li key={item} className="flex gap-3 text-slate-300"><Info className="mt-0.5 h-5 w-5 shrink-0 text-[#c9a84c]" />{item}</li>)}
            </ul>
            <p className="mt-6 border-t border-white/10 pt-6 text-sm leading-relaxed text-slate-400">As simulações são estimativas. Condições, taxas, reajustes e critérios dependem do grupo e da administradora escolhidos.</p>
          </aside>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#0d1e33] px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[.28em] text-[#c9a84c]">Dúvidas frequentes</p>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">Perguntas sobre {page.title.toLowerCase()}</h2>
          <div className="mt-8 divide-y divide-white/10">
            {page.faq.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="cursor-pointer list-none pr-8 text-lg font-bold marker:hidden">{item.question}</summary>
                <p className="mt-3 max-w-3xl leading-relaxed text-slate-300">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 text-center sm:px-6">
        <h2 className="text-3xl font-black sm:text-4xl">Compare um cenário para o seu objetivo</h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-300">Informe valor, prazo e modalidade para visualizar uma estimativa e conversar com um especialista.</p>
        <Link href={page.simulatorHref} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#c9a84c] px-7 py-3.5 font-bold text-[#07111f]">Abrir simulador <ArrowRight className="h-5 w-5" /></Link>
      </section>
    </main>
  );
}
