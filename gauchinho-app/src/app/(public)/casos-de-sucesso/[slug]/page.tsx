import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { ConteudoBackLink, ConteudoHero, ConteudoPageShell } from "@/components/conteudo/conteudo-hero";
import { ConteudoCTA } from "@/components/conteudo/conteudo-cta";
import { ConteudoViewTracker } from "@/components/conteudo/conteudo-view-tracker";
import { fetchPublicCasoBySlug, fetchPublicCasosSucesso, seoFromCaso } from "@/lib/conteudo/fetch-public";
import { buildSimuladorUrl } from "@/lib/home/build-simulador-url";
import { DEFAULT_CONTATO, type ContatoConfig } from "@/lib/config/defaults";
import { getConfigJsonPublic } from "@/server/config";
import { formatCurrency } from "@/lib/utils/format";
import { CasoSucessoCard } from "@/components/conteudo/caso-sucesso-card";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const caso = await fetchPublicCasoBySlug(slug);
  if (!caso) return { title: "Caso não encontrado" };
  const seo = seoFromCaso(caso);
  return {
    title: `${seo.title} | Gauchinho`,
    description: seo.description,
    openGraph: { title: seo.title, description: seo.description },
  };
}

function whatsappHref(contato: ContatoConfig, titulo: string) {
  const n = contato.whatsappPrincipal?.replace(/\D/g, "");
  if (!n) return "#contato";
  const text = encodeURIComponent(
    `Olá! Li a história "${titulo}" no site e quero planejar uma conquista parecida.`,
  );
  return `https://wa.me/${n}?text=${text}`;
}

export default async function CasoSucessoSlugPage({ params }: Props) {
  const { slug } = await params;
  const caso = await fetchPublicCasoBySlug(slug);
  if (!caso) notFound();

  const [contato, relacionados] = await Promise.all([
    getConfigJsonPublic("contato", DEFAULT_CONTATO),
    fetchPublicCasosSucesso({ categoria: caso.categoria ?? undefined, limit: 4 }),
  ]);
  const outros = relacionados.filter((c) => c.id !== caso.id).slice(0, 3);
  const local = [caso.cidade, caso.estado].filter(Boolean).join(" — ");

  return (
    <ConteudoPageShell>
      <ConteudoViewTracker
        tipo_evento="caso_sucesso_visualizado"
        entidade_tipo="caso"
        entidade_id={caso.id}
      />
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
        <ConteudoBackLink href="/depoimentos#casos-de-sucesso">Depoimentos e casos</ConteudoBackLink>
      </div>
      <ConteudoHero title={caso.titulo} eyebrow={caso.categoria ?? undefined} subtitle={caso.descricao_curta ?? undefined} />
      <article className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        {caso.imagem_url ? (
          <div className="relative mb-10 aspect-[16/9] overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
            <Image src={caso.imagem_url} alt="" fill className="object-cover" priority />
          </div>
        ) : null}
        {caso.video_url ? (
          <div className="mb-10 aspect-video overflow-hidden rounded-3xl border border-zinc-800">
            <iframe
              src={caso.video_url}
              title={caso.titulo}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : null}
        <dl className="mb-8 grid gap-3 text-sm sm:grid-cols-2">
          {local ? (
            <div>
              <dt className="text-zinc-500">Local</dt>
              <dd className="font-medium text-white">{local}</dd>
            </div>
          ) : null}
          {caso.tipo_objetivo ? (
            <div>
              <dt className="text-zinc-500">Objetivo</dt>
              <dd className="font-medium text-white">{caso.tipo_objetivo}</dd>
            </div>
          ) : null}
          {caso.valor_credito != null ? (
            <div>
              <dt className="text-zinc-500">Crédito (referência)</dt>
              <dd className="font-medium text-amber-400">{formatCurrency(Number(caso.valor_credito))}</dd>
            </div>
          ) : null}
        </dl>
        {caso.conteudo ? (
          <div className="prose prose-invert max-w-none whitespace-pre-wrap text-base leading-relaxed text-zinc-300">
            {caso.conteudo}
          </div>
        ) : null}
        <div className="mt-12">
          <ConteudoCTA
            simuladorHref={buildSimuladorUrl({ origem: "caso", tipo: "imovel" })}
            whatsappHref={whatsappHref(contato, caso.titulo)}
            simuladorLabel="Quero planejar uma conquista parecida"
          />
        </div>
        {outros.length ? (
          <section className="mt-16 border-t border-zinc-800 pt-12">
            <h2 className="text-lg font-bold text-white">Outras histórias</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {outros.map((c) => (
                <CasoSucessoCard key={c.id} caso={c} />
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </ConteudoPageShell>
  );
}
