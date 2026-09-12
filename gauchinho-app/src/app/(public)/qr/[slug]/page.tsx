import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventoSorteioPublicForm } from "@/components/public/eventos/evento-sorteio-public-form";
import { EventoCheckinConversacional } from "@/components/public/eventos/evento-checkin-conversacional";
import { QrUnicoSemEventoForm } from "@/components/public/eventos/qr-unico-sem-evento-form";
import { resolveQrPublicBySlug } from "@/lib/eventos-sorteio/qr-unico";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function QrUnicoPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resolved = await resolveQrPublicBySlug(slug);
  if (!resolved) notFound();

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-8">
      {resolved.mode === "evento" ? (
        Boolean(resolved.sorteio.checkinInterativoAtivo) ? (
          <EventoCheckinConversacional
            evento={{
              id: resolved.sorteio.eventoId,
              nome: resolved.sorteio.eventoNome,
              slug: resolved.sorteio.eventoSlug,
              corPrimaria: resolved.sorteio.corPrimaria,
              corSecundaria: resolved.sorteio.corSecundaria,
              logoPersonalizadoUrl: resolved.sorteio.logoPersonalizadoUrl,
            }}
            qrCodeUnicoId={resolved.qr.id}
          />
        ) : (
          <EventoSorteioPublicForm sorteio={resolved.sorteio} qrCodeUnicoId={resolved.qr.id} />
        )
      ) : (
        <QrUnicoSemEventoForm
          qrNome={resolved.qr.nome}
          qrSlug={resolved.qr.slug}
          qrCodeUnicoId={resolved.qr.id}
          motivo={resolved.motivo}
          eventoNome={resolved.eventoNome}
        />
      )}
      <p className="mt-6 text-center text-xs text-slate-500">QR Code oficial · Presença e sorteio</p>
    </main>
  );
}
