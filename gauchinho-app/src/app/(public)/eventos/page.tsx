import type { Metadata } from "next";
import { PublicPremiumHero } from "@/components/public/public-premium-hero";
import { EventoListCard } from "@/components/public/eventos/evento-list-card";
import { HomeV2ParceirosStrip } from "@/components/public/home/home-v2-parceiros-strip";
import { simuladorShell } from "@/components/simulador/simulador-ui";
import { fetchPublicEventosList } from "@/lib/comercial-eventos/public";
import { loadHomeConteudoDestaques } from "@/lib/home/load-home-data";

export const metadata: Metadata = {
  title: "Eventos | Gauchinho",
  description: "Encontros, apresentações e ações comerciais do Gauchinho Consórcios.",
};

export const dynamic = "force-dynamic";

export default async function EventosPublicPage() {
  const [eventos, conteudo] = await Promise.all([
    fetchPublicEventosList(),
    loadHomeConteudoDestaques(),
  ]);

  return (
    <div className={simuladorShell}>
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-6 sm:pt-14">
        <PublicPremiumHero
          eyebrow="Gauchinho · Eventos"
          title="Eventos"
          subtitle="Jantares, encontros e apresentações — inscreva-se e participe."
        />

        <div className="mx-auto max-w-5xl">
          {eventos.length === 0 ? (
            <p className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-8 text-center text-slate-400 shadow-lg shadow-black/20">
              Nenhum evento público no momento. Fale com um especialista para saber das próximas datas.
            </p>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2">
              {eventos.map((ev) => (
                <EventoListCard key={ev.id} evento={ev} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {conteudo.parceirosDestaque.length > 0 ? (
        <HomeV2ParceirosStrip parceiros={conteudo.parceirosDestaque} anchorFooter />
      ) : null}
    </div>
  );
}
