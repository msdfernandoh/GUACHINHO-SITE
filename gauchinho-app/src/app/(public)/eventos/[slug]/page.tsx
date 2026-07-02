import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConteudoHero, ConteudoPageShell } from "@/components/conteudo/conteudo-hero";
import { EventoInscricaoForm } from "@/components/public/eventos/evento-inscricao-form";
import {
  countVagasUsadasEvento,
  fetchPublicEventoBySlug,
  fetchPublicEventoPosts,
} from "@/lib/comercial-eventos/public";
import { vagasRestantes } from "@/lib/comercial-eventos/vagas";
import { buildSimuladorUrl } from "@/lib/home/build-simulador-url";
import { formatDateTime } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ev = await fetchPublicEventoBySlug(slug);
  if (!ev) return { title: "Evento | Gauchinho" };
  return { title: `${ev.nome} | Eventos Gauchinho`, description: ev.descricao_curta ?? undefined };
}

export default async function EventoSlugPage({ params }: Props) {
  const { slug } = await params;
  const evento = await fetchPublicEventoBySlug(slug);
  if (!evento) notFound();

  const [posts, vagasUsadas] = await Promise.all([
    fetchPublicEventoPosts(evento.id),
    countVagasUsadasEvento(evento.id),
  ]);
  const restantes = vagasRestantes(evento.limite_participantes, vagasUsadas);

  return (
    <ConteudoPageShell>
      {evento.banner_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <div className="relative h-48 w-full overflow-hidden sm:h-64">
          <img src={evento.banner_url} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}
      <ConteudoHero
        eyebrow="Evento"
        title={evento.nome}
        subtitle={
          [
            evento.data_evento ? formatDateTime(evento.data_evento, null) : null,
            evento.local ?? evento.cidade,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />
      <div className="mx-auto grid max-w-5xl gap-10 px-4 pb-20 sm:px-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-8">
          {evento.descricao ? (
            <div className="prose prose-invert max-w-none whitespace-pre-wrap text-zinc-300">{evento.descricao}</div>
          ) : null}
          {evento.endereco ? (
            <p className="text-sm text-zinc-500">
              <span className="font-semibold text-zinc-400">Endereço:</span> {evento.endereco}
              {evento.cidade ? ` — ${evento.cidade}` : ""}
              {evento.estado ? `/${evento.estado}` : ""}
            </p>
          ) : null}

          {posts.length > 0 ? (
            <section>
              <h2 className="text-xl font-bold text-white">Fotos e novidades</h2>
              <ul className="mt-4 space-y-6">
                {posts.map((p) => (
                  <li key={p.id} className="rounded-xl border border-zinc-800 p-4">
                    {p.imagem_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imagem_url} alt={p.titulo ?? ""} className="mb-3 max-h-80 w-full rounded-lg object-cover" />
                    ) : null}
                    {p.titulo ? <h3 className="font-semibold text-white">{p.titulo}</h3> : null}
                    {p.conteudo ? <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">{p.conteudo}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Link
            href={buildSimuladorUrl({ origem: "evento" })}
            className="inline-block text-sm font-semibold text-amber-400 hover:underline"
          >
            Falar com especialista / simular →
          </Link>
        </div>

        <aside className="space-y-4">
          {evento.mostrar_vagas && evento.limite_participantes ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-300">
              {restantes != null && restantes <= 0
                ? "Vagas limitadas — inscrição sujeita à disponibilidade no envio."
                : restantes != null
                  ? `${restantes} vaga(s) disponível(is) (estimativa).`
                  : null}
            </p>
          ) : null}
          <EventoInscricaoForm
            slug={evento.slug}
            permitirAcompanhante={evento.permitir_acompanhante}
            exigirConvidou={evento.exigir_convidou}
          />
        </aside>
      </div>
    </ConteudoPageShell>
  );
}
