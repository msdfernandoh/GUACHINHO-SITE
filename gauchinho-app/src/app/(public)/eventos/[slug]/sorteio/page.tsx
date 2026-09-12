import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventoSorteioPublicForm } from "@/components/public/eventos/evento-sorteio-public-form";
import { EventoCheckinConversacional } from "@/components/public/eventos/evento-checkin-conversacional";
import { fetchPublicSorteioByEventoSlug } from "@/lib/eventos-sorteio/public";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function EventoSorteioPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sorteio = await fetchPublicSorteioByEventoSlug(slug);
  if (!sorteio) notFound();

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-8">
      {Boolean(sorteio.checkinInterativoAtivo) ? (
        <EventoCheckinConversacional
          evento={{
            id: sorteio.eventoId,
            nome: sorteio.eventoNome,
            slug: sorteio.eventoSlug,
            corPrimaria: sorteio.corPrimaria,
            corSecundaria: sorteio.corSecundaria,
            logoPersonalizadoUrl: sorteio.logoPersonalizadoUrl,
          }}
        />
      ) : (
        <EventoSorteioPublicForm sorteio={sorteio} />
      )}
      <p className="mt-6 text-center text-xs text-slate-500">Presença e sorteio de brindes</p>
    </main>
  );
}
