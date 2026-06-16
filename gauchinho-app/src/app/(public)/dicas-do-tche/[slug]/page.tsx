import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { ConteudoBackLink, ConteudoHero, ConteudoPageShell } from "@/components/conteudo/conteudo-hero";
import { ConteudoCTA } from "@/components/conteudo/conteudo-cta";
import { ConteudoViewTracker } from "@/components/conteudo/conteudo-view-tracker";
import { DicaTcheCard } from "@/components/conteudo/dica-tche-card";
import { fetchPublicDicaBySlug, fetchPublicDicas, seoFromDica } from "@/lib/conteudo/fetch-public";
import { buildSimuladorUrl } from "@/lib/home/build-simulador-url";
import { DEFAULT_CONTATO, type ContatoConfig } from "@/lib/config/defaults";
import { getConfigJsonPublic } from "@/server/config";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const dica = await fetchPublicDicaBySlug(slug);
  if (!dica) return { title: "Dica não encontrada" };
  const seo = seoFromDica(dica);
  return {
    title: `${seo.title} | Dicas do Tchê`,
    description: seo.description,
    openGraph: { title: seo.title, description: seo.description },
  };
}

function whatsappHref(contato: ContatoConfig, titulo: string) {
  const n = contato.whatsappPrincipal?.replace(/\D/g, "");
  if (!n) return "#contato";
  return `https://wa.me/${n}?text=${encodeURIComponent(`Olá! Li a dica "${titulo}" e quero conversar com um especialista.`)}`;
}

export default async function DicaSlugPage({ params }: Props) {
  const { slug } = await params;
  const dica = await fetchPublicDicaBySlug(slug);
  if (!dica) notFound();

  const [contato, todas] = await Promise.all([
    getConfigJsonPublic("contato", DEFAULT_CONTATO),
    fetchPublicDicas({ categoria: dica.categoria ?? undefined, limit: 6 }),
  ]);
  const relacionadas = todas.filter((d) => d.id !== dica.id).slice(0, 3);

  return (
    <ConteudoPageShell>
      <ConteudoViewTracker tipo_evento="dica_visualizada" entidade_tipo="dica" entidade_id={dica.id} />
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
        <ConteudoBackLink href="/dicas-do-tche">Dicas do Tchê</ConteudoBackLink>
      </div>
      <ConteudoHero title={dica.titulo} eyebrow={dica.categoria ?? undefined} />
      <article className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        {dica.imagem_url ? (
          <div className="relative mb-10 aspect-[16/9] overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
            <Image src={dica.imagem_url} alt="" fill className="object-cover" priority />
          </div>
        ) : null}
        {dica.conteudo ? (
          <div className="whitespace-pre-wrap text-base leading-relaxed text-zinc-300">{dica.conteudo}</div>
        ) : (
          <p className="text-zinc-500">Conteúdo em atualização.</p>
        )}
        <div className="mt-12">
          <ConteudoCTA
            simuladorHref={buildSimuladorUrl({ origem: "dica" })}
            whatsappHref={whatsappHref(contato, dica.titulo)}
          />
        </div>
        {relacionadas.length ? (
          <section className="mt-16 border-t border-zinc-800 pt-12">
            <h2 className="text-lg font-bold text-white">Dicas relacionadas</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {relacionadas.map((d) => (
                <DicaTcheCard key={d.id} dica={d} />
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </ConteudoPageShell>
  );
}
