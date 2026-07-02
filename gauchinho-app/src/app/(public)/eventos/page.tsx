import type { Metadata } from "next";
import Link from "next/link";
import { ConteudoHero, ConteudoPageShell } from "@/components/conteudo/conteudo-hero";
import { fetchPublicEventosList } from "@/lib/comercial-eventos/public";
import { formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Eventos | Gauchinho",
  description: "Encontros, apresentações e ações comerciais do Gauchinho Consórcios.",
};

export const dynamic = "force-dynamic";

export default async function EventosPublicPage() {
  const eventos = await fetchPublicEventosList();

  return (
    <ConteudoPageShell>
      <ConteudoHero
        eyebrow="Comercial"
        title="Eventos"
        subtitle="Jantares, encontros e apresentações — inscreva-se e participe."
      />
      <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        {eventos.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-8 text-center text-zinc-400">
            Nenhum evento público no momento. Fale com um especialista para saber das próximas datas.
          </p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2">
            {eventos.map((ev) => (
              <li
                key={ev.id}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80 transition hover:border-amber-500/30"
              >
                {ev.imagem_capa_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ev.imagem_capa_url} alt="" className="h-40 w-full object-cover" />
                ) : null}
                <div className="p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-500">
                    {ev.data_evento ? formatDateTime(ev.data_evento, null) : "Data a confirmar"}
                  </p>
                  <h2 className="mt-2 text-lg font-bold text-white">{ev.nome}</h2>
                  <p className="mt-1 text-sm text-zinc-400">{ev.descricao_curta ?? ev.cidade ?? ev.local ?? ""}</p>
                  <Link
                    href={`/eventos/${ev.slug}`}
                    className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-amber-500/15 px-4 text-sm font-semibold text-amber-300 hover:bg-amber-500/25"
                  >
                    Ver evento →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ConteudoPageShell>
  );
}
