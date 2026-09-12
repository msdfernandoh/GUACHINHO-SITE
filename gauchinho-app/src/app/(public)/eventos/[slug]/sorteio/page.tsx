import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventoSorteioPublicForm } from "@/components/public/eventos/evento-sorteio-public-form";
import { EventoCheckinConversacional } from "@/components/public/eventos/evento-checkin-conversacional";
import { EventoCheckinFechado } from "@/components/public/eventos/evento-checkin-fechado";
import { fetchPublicSorteioByEventoSlug } from "@/lib/eventos-sorteio/public";
import { resolverStatusCheckinEvento } from "@/lib/eventos-sorteio/disponibilidade";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export default async function EventoSorteioPublicPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { preview } = await searchParams;

  let isPreview = false;
  if (preview === "1" || preview === "true") {
    try {
      const u = await getUsuarioNegocio();
      if (canManageImobiliarias(u?.perfil)) {
        isPreview = true;
      }
    } catch {
      isPreview = false;
    }
  }

  const sorteio = await fetchPublicSorteioByEventoSlug(slug, {
    allowFallback: isPreview,
    requirePublicado: !isPreview,
  });
  if (!sorteio) notFound();

  const usarCheckinConversacional = Boolean(sorteio.checkinInterativoAtivo || isPreview);

  if (usarCheckinConversacional && !isPreview) {
    const disp = resolverStatusCheckinEvento({
      ativo: true,
      checkin_interativo_ativo: true,
      data_evento: sorteio.eventoData,
      checkin_modo: sorteio.checkinModo,
      checkin_abertura_antecipada_minutos: sorteio.checkinAberturaAntecipadaMinutos,
    });

    if (!disp.aberto) {
      return (
        <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-8">
          <EventoCheckinFechado
            evento={{
              id: sorteio.eventoId,
              nome: sorteio.eventoNome,
              slug: sorteio.eventoSlug,
              corPrimaria: sorteio.corPrimaria,
              corSecundaria: sorteio.corSecundaria,
              logoPersonalizadoUrl: sorteio.logoPersonalizadoUrl,
            }}
            disponibilidade={disp}
          />
        </main>
      );
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-8">
      {usarCheckinConversacional ? (
        <EventoCheckinConversacional
          evento={{
            id: sorteio.eventoId,
            nome: sorteio.eventoNome,
            slug: sorteio.eventoSlug,
            corPrimaria: sorteio.corPrimaria,
            corSecundaria: sorteio.corSecundaria,
            logoPersonalizadoUrl: sorteio.logoPersonalizadoUrl,
          }}
          isPreview={isPreview}
        />
      ) : (
        <EventoSorteioPublicForm sorteio={sorteio} />
      )}
      <p className="mt-6 text-center text-xs text-slate-500">Presença e sorteio de brindes</p>
    </main>
  );
}
