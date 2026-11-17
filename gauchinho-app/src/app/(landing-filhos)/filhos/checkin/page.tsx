import type { Metadata } from "next";
import { EventoCheckinConversacional } from "@/components/public/eventos/evento-checkin-conversacional";
import { EventoCheckinFechado } from "@/components/public/eventos/evento-checkin-fechado";
import { carregarEventoHeranca } from "@/lib/heranca-inteligente/evento";
import { fetchPublicSorteioByEventoSlug } from "@/lib/eventos-sorteio/public";
import { resolverStatusCheckinEvento } from "@/lib/eventos-sorteio/disponibilidade";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Check-in · Encontro Método Herança Inteligente" },
  robots: { index: false, follow: false },
};

/** Check-in do encontro (presença, perguntas e número da sorte) dentro do site do Herança. */
export default async function HerancaCheckinPage() {
  const evento = await carregarEventoHeranca();
  const sorteio = evento ? await fetchPublicSorteioByEventoSlug(evento.slug, { requirePublicado: false }) : null;

  if (!sorteio) {
    return (
      <main className="mx-auto flex min-h-[80vh] max-w-lg flex-col justify-center bg-white px-4 py-8 text-center">
        <div className="text-2xl font-black text-[#0f172a]">Check-in indisponível</div>
        <div className="mt-2 text-base text-[#334155]">O check-in do encontro abre no dia do evento.</div>
      </main>
    );
  }

  const dadosEvento = {
    id: sorteio.eventoId,
    nome: sorteio.eventoNome,
    slug: sorteio.eventoSlug,
    corPrimaria: sorteio.corPrimaria,
    corSecundaria: sorteio.corSecundaria,
    logoPersonalizadoUrl: sorteio.logoPersonalizadoUrl,
  };

  const disp = resolverStatusCheckinEvento({
    ativo: true,
    checkin_interativo_ativo: true,
    data_evento: sorteio.eventoData,
    checkin_modo: sorteio.checkinModo,
    checkin_abertura_antecipada_minutos: sorteio.checkinAberturaAntecipadaMinutos,
  });

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-lg flex-col justify-center bg-white px-4 py-8">
      {disp.aberto ? (
        <EventoCheckinConversacional
          evento={{ ...dadosEvento, tipoCheckin: "evento", whatsappEquipe: sorteio.whatsappEquipe }}
        />
      ) : (
        <EventoCheckinFechado evento={dadosEvento} disponibilidade={disp} />
      )}
    </main>
  );
}
